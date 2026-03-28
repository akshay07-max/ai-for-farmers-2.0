// ================================================================
// LEARNING SERVICE
// ================================================================
const axios = require("axios");
const Course = require("../../models/Course");
const LearningPath = require("../../models/LearningPath");
const LearningSubscription = require("../../models/LearningSubscription");
const TutorSession = require("../../models/TutorSession");
const User = require("../../models/User");
const { AppError } = require("../../middlewares/errorHandler");
const logger = require("../../utils/logger");

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_TIMEOUT = 60000;

// ── Helpers ───────────────────────────────────────────────────

const getOrCreateSubscription = async (userId) => {
  let sub = await LearningSubscription.findOne({ userId });
  if (!sub) {
    sub = await LearningSubscription.create({ userId, plan: "LEARNING_FREE" });
  }
  return sub;
};

const callAI = async (endpoint, data) => {
  const res = await axios.post(`${AI_URL}${endpoint}`, data, {
    timeout: AI_TIMEOUT,
  });
  return res.data;
};

// Find a lesson by its ID within a course
const findLesson = (course, lessonId) => {
  for (const mod of course.modules) {
    const lesson = mod.lessons.id(lessonId);
    if (lesson) return { lesson, module: mod };
  }
  return null;
};

// ── Subscription ──────────────────────────────────────────────

const getPlans = () => {
  const { LEARNING_PLANS } = require("../../models/LearningSubscription");
  return Object.entries(LEARNING_PLANS).map(([key, plan]) => ({
    id: key,
    name: plan.name,
    monthlyPrice: plan.price.monthly / 100,
    yearlyPrice: plan.price.yearly / 100,
    sessionLimit: plan.sessionLimit,
    courseLimit: plan.courseLimit,
    features: plan.features,
  }));
};

const getMySubscription = async (userId) => {
  const sub = await getOrCreateSubscription(userId);
  return sub;
};

// ── Course Catalogue ──────────────────────────────────────────

const getCourses = async (filters = {}) => {
  const query = { isPublished: true };
  if (filters.category) query.category = filters.category;
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.crop) query.targetCrops = { $in: [filters.crop] };

  return Course.find(query)
    .select(
      "title titleMr titleHi description category targetCrops difficulty estimatedHours enrollmentCount avgRating thumbnail",
    )
    .sort({ enrollmentCount: -1 });
};

const getCourseDetail = async (courseId) => {
  const course = await Course.findOne({ _id: courseId, isPublished: true });
  if (!course) throw new AppError("Course not found.", 404, "ERR_LRN_001");
  return course;
};

// ── Enrollment ────────────────────────────────────────────────

const enrollCourse = async (userId, courseId, language) => {
  const [course, sub] = await Promise.all([
    Course.findOne({ _id: courseId, isPublished: true }),
    getOrCreateSubscription(userId),
  ]);

  if (!course) throw new AppError("Course not found.", 404, "ERR_LRN_001");

  // Check plan limits
  const { LEARNING_PLANS } = require("../../models/LearningSubscription");
  const planConfig = LEARNING_PLANS[sub.plan];

  if (planConfig.courseLimit === 0) {
    throw new AppError(
      "Upgrade to Learning Basic or Pro to enroll in courses.",
      403,
      "ERR_LRN_002",
    );
  }

  if (planConfig.courseLimit > 0) {
    const activeCount = await LearningPath.countDocuments({
      userId,
      status: { $in: ["ENROLLED", "IN_PROGRESS"] },
    });
    if (activeCount >= planConfig.courseLimit) {
      throw new AppError(
        `Your plan allows ${planConfig.courseLimit} active courses. Complete or drop one first.`,
        403,
        "ERR_LRN_003",
      );
    }
  }

  // Check if already enrolled
  const existing = await LearningPath.findOne({ userId, courseId });
  if (existing) {
    if (existing.status === "DROPPED") {
      existing.status = "ENROLLED";
      await existing.save();
      return existing;
    }
    throw new AppError("Already enrolled in this course.", 409, "ERR_LRN_004");
  }

  // Set starting position
  const firstModule = course.modules.sort((a, b) => a.sequence - b.sequence)[0];
  const firstLesson = firstModule?.lessons.sort(
    (a, b) => a.sequence - b.sequence,
  )[0];

  const user = await User.findById(userId).select("languagePreference");

  const path = await LearningPath.create({
    userId,
    courseId,
    status: "ENROLLED",
    currentModuleId: firstModule?._id,
    currentLessonId: firstLesson?._id,
    language: language || user?.languagePreference || "mr",
  });

  // Increment enrollment count
  await Course.findByIdAndUpdate(courseId, { $inc: { enrollmentCount: 1 } });

  return path;
};

const getMyPaths = async (userId) => {
  const paths = await LearningPath.find({
    userId,
    status: { $in: ["ENROLLED", "IN_PROGRESS", "COMPLETED"] },
  }).populate(
    "courseId",
    "title titleMr titleHi category thumbnail estimatedHours",
  );

  return paths;
};

const getMyPath = async (userId, courseId) => {
  const path = await LearningPath.findOne({ userId, courseId }).populate(
    "courseId",
  );
  if (!path)
    throw new AppError("Not enrolled in this course.", 404, "ERR_LRN_005");
  return path;
};

// ── AI Content Generation ─────────────────────────────────────

/**
 * Get lesson content — returns cached if available, generates if not.
 */
const getLessonContent = async (userId, courseId, lessonId, language) => {
  const course = await Course.findById(courseId);
  if (!course) throw new AppError("Course not found.", 404, "ERR_LRN_001");

  const found = findLesson(course, lessonId);
  if (!found) throw new AppError("Lesson not found.", 404, "ERR_LRN_006");
  const { lesson } = found;

  const lang = language || "mr";

  // Return cached content if available
  if (lesson.generatedContent?.[lang]) {
    return {
      lesson,
      content: lesson.generatedContent[lang],
      audioUrl: lesson.audioUrls?.[lang] || null,
      fromCache: true,
    };
  }

  // Get farmer context for personalization
  const user = await User.findById(userId).select("district primaryCrops");

  // Generate content via Python AI service
  logger.info(`Generating lesson content: ${lesson.title} [${lang}]`);
  let content;
  try {
    const result = await callAI("/tutor/generate-lesson", {
      ai_prompt: lesson.aiPrompt,
      language: lang,
      farmer_context: {
        district: user?.district,
        primaryCrops: user?.primaryCrops || [],
      },
    });
    content = result.content;
  } catch (err) {
    throw new AppError(
      `AI content generation failed: ${err.message}`,
      502,
      "ERR_LRN_007",
    );
  }

  // Cache the generated content
  await Course.findOneAndUpdate(
    { _id: courseId, "modules.lessons._id": lessonId },
    {
      $set: {
        [`modules.$[].lessons.$[lesson].generatedContent.${lang}`]: content,
        [`modules.$[].lessons.$[lesson].generatedContent.generatedAt`]:
          new Date(),
      },
    },
    { arrayFilters: [{ "lesson._id": lessonId }] },
  );

  return { lesson, content, audioUrl: null, fromCache: false };
};

// ── Live Tutor Session ────────────────────────────────────────

const startTutorSession = async (userId, courseId, lessonId, language) => {
  const [sub, user, course] = await Promise.all([
    getOrCreateSubscription(userId),
    User.findById(userId).select(
      "name district primaryCrops languagePreference",
    ),
    Course.findById(courseId),
  ]);

  if (!course) throw new AppError("Course not found.", 404, "ERR_LRN_001");

  // Check session limit
  if (!sub.canStartSession()) {
    const { LEARNING_PLANS } = require("../../models/LearningSubscription");
    const limit = LEARNING_PLANS[sub.plan].sessionLimit;
    throw new AppError(
      `You've used all ${limit} sessions this month. Upgrade to Learning Pro for unlimited sessions.`,
      403,
      "ERR_LRN_008",
    );
  }

  const found = findLesson(course, lessonId);
  if (!found) throw new AppError("Lesson not found.", 404, "ERR_LRN_006");
  const { lesson } = found;

  const lang = language || user?.languagePreference || "mr";

  // Get lesson content (generate if needed)
  const { content } = await getLessonContent(userId, courseId, lessonId, lang);

  // Call Python AI to generate opening message
  let aiResult;
  try {
    aiResult = await callAI("/tutor/start-session", {
      lesson_title: lesson.title,
      lesson_content: content,
      language: lang,
      farmer_name: user?.name || "शेतकरी",
      farmer_context: {
        district: user?.district,
        primaryCrops: user?.primaryCrops || [],
      },
    });
  } catch (err) {
    throw new AppError(
      `Failed to start tutor session: ${err.message}`,
      502,
      "ERR_LRN_009",
    );
  }

  // Create session in DB
  const session = await TutorSession.create({
    userId,
    courseId,
    lessonId,
    language: lang,
    stage: aiResult.stage || "INTRO",
    messages: [{ role: "tutor", content: aiResult.message }],
    teachingState: aiResult.teaching_state || {},
  });

  // Increment usage counter
  sub.usage.sessionsThisMonth += 1;
  await sub.save();

  // Mark path as in progress
  await LearningPath.findOneAndUpdate(
    { userId, courseId },
    {
      status: "IN_PROGRESS",
      lastStudiedAt: new Date(),
      $inc: { sessionsCount: 1 },
    },
  );

  return { session, openingMessage: aiResult.message };
};

const sendTutorMessage = async (userId, sessionId, message) => {
  const session = await TutorSession.findOne({ _id: sessionId, userId });
  if (!session) throw new AppError("Session not found.", 404, "ERR_LRN_010");
  if (session.completed)
    throw new AppError(
      "This lesson session is already complete.",
      400,
      "ERR_LRN_011",
    );

  // Get lesson content
  const { content } = await getLessonContent(
    userId,
    session.courseId,
    session.lessonId,
    session.language,
  );

  // Add farmer message to history
  session.messages.push({ role: "farmer", content: message });

  // Call Python AI for tutor response
  let aiResult;
  try {
    aiResult = await callAI("/tutor/continue-session", {
      farmer_message: message,
      session_history: session.messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      lesson_content: content,
      teaching_state: session.teachingState,
      stage: session.stage,
      language: session.language,
    });
  } catch (err) {
    throw new AppError(
      `Tutor response failed: ${err.message}`,
      502,
      "ERR_LRN_012",
    );
  }

  // Update session
  session.messages.push({ role: "tutor", content: aiResult.message });
  session.stage = aiResult.stage;
  session.teachingState = aiResult.teaching_state || session.teachingState;
  session.completed = aiResult.completed || false;

  if (session.completed) {
    session.completedAt = new Date();
    session.durationMinutes = Math.ceil(session.messages.length * 1.5); // estimate

    // Mark lesson as completed in learning path
    await LearningPath.findOneAndUpdate(
      { userId, courseId: session.courseId },
      {
        $addToSet: { completedLessons: session.lessonId },
        $set: { lastStudiedAt: new Date() },
        $inc: { totalMinutesSpent: session.durationMinutes },
      },
    );
  }

  await session.save();

  return {
    message: aiResult.message,
    stage: session.stage,
    completed: session.completed,
  };
};

const completeTutorSession = async (userId, sessionId) => {
  const session = await TutorSession.findOne({ _id: sessionId, userId });
  if (!session) throw new AppError("Session not found.", 404, "ERR_LRN_010");

  session.completed = true;
  session.completedAt = new Date();
  await session.save();

  await LearningPath.findOneAndUpdate(
    { userId, courseId: session.courseId },
    {
      $addToSet: { completedLessons: session.lessonId },
      $set: { lastStudiedAt: new Date() },
    },
  );

  return { completed: true };
};

// ── Quiz ──────────────────────────────────────────────────────

const getQuiz = async (userId, courseId, lessonId, language) => {
  const course = await Course.findById(courseId);
  if (!course) throw new AppError("Course not found.", 404, "ERR_LRN_001");

  const found = findLesson(course, lessonId);
  if (!found) throw new AppError("Lesson not found.", 404, "ERR_LRN_006");
  const { lesson } = found;

  const lang = language || "mr";

  // Return cached quiz if available
  if (lesson.quiz?.questions?.length) {
    return lesson.quiz.questions;
  }

  // Get lesson content first
  const { content } = await getLessonContent(userId, courseId, lessonId, lang);

  // Generate quiz via Python AI
  let questions;
  try {
    const result = await callAI("/tutor/generate-quiz", {
      lesson_content: content,
      language: lang,
      num_questions: 4,
    });
    questions = result.questions;
  } catch (err) {
    throw new AppError(
      `Quiz generation failed: ${err.message}`,
      502,
      "ERR_LRN_013",
    );
  }

  // Cache quiz
  await Course.findOneAndUpdate(
    { _id: courseId, "modules.lessons._id": lessonId },
    {
      $set: {
        "modules.$[].lessons.$[lesson].quiz.questions": questions,
        "modules.$[].lessons.$[lesson].quiz.generatedAt": new Date(),
      },
    },
    { arrayFilters: [{ "lesson._id": lessonId }] },
  );

  return questions;
};

const submitQuiz = async (userId, courseId, lessonId, answers, language) => {
  const questions = await getQuiz(userId, courseId, lessonId, language);
  const lang = language || "mr";

  let totalScore = 0;
  const results = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const answer = answers[i];

    if (q.type === "MCQ") {
      const correct = answer === q.correct;
      results.push({
        questionIndex: i,
        correct,
        score: correct ? 100 : 0,
        feedback: correct
          ? q.explanation || "Correct!"
          : `Correct answer: option ${q.correct + 1}. ${q.explanation || ""}`,
      });
      if (correct) totalScore += 100;
    } else if (q.type === "OPEN") {
      // Evaluate open answer via Python AI
      let evaluation;
      try {
        const res = await callAI("/tutor/evaluate-answer", {
          question: q.question,
          answer: answer || "",
          criteria: q.evaluationCriteria || "",
          language: lang,
        });
        evaluation = res;
      } catch {
        evaluation = { score: 70, passed: true, feedback: "Good effort!" };
      }
      results.push({ questionIndex: i, ...evaluation });
      totalScore += evaluation.score || 0;
    }
  }

  const finalScore = Math.round(totalScore / questions.length);
  const passed = finalScore >= 60;

  // Save quiz score to learning path
  await LearningPath.findOneAndUpdate(
    { userId, courseId },
    {
      $push: {
        quizScores: {
          lessonId,
          score: finalScore,
          passed,
          completedAt: new Date(),
        },
      },
    },
    { upsert: false },
  );

  return { score: finalScore, passed, results, passingScore: 60 };
};

// ── Syllabus Builder ──────────────────────────────────────────

const syllabusChat = async (userId, message, conversationHistory, language) => {
  const [user, courses] = await Promise.all([
    User.findById(userId).select("name district primaryCrops"),
    Course.find({ isPublished: true }).select(
      "_id title titleMr category difficulty targetCrops",
    ),
  ]);

  const lang = language || user?.languagePreference || "mr";

  const availableCourses = courses.map((c) => ({
    id: c._id.toString(),
    title: c.title,
    category: c.category,
    difficulty: c.difficulty,
    crops: c.targetCrops,
  }));

  let result;
  try {
    result = await callAI("/tutor/syllabus-chat", {
      farmer_message: message,
      conversation: conversationHistory,
      farmer_context: {
        district: user?.district,
        primaryCrops: user?.primaryCrops || [],
      },
      available_courses: availableCourses,
      language: lang,
    });
  } catch (err) {
    throw new AppError(
      `Syllabus builder failed: ${err.message}`,
      502,
      "ERR_LRN_014",
    );
  }

  return result;
};

// ── Stats ─────────────────────────────────────────────────────

const getStats = async (userId) => {
  const [paths, sub] = await Promise.all([
    LearningPath.find({ userId }),
    getOrCreateSubscription(userId),
  ]);

  const completed = paths.filter((p) => p.status === "COMPLETED").length;
  const inProgress = paths.filter((p) => p.status === "IN_PROGRESS").length;
  const totalMinutes = paths.reduce(
    (s, p) => s + (p.totalMinutesSpent || 0),
    0,
  );
  const maxStreak = paths.reduce(
    (m, p) => Math.max(m, p.longestStreak || 0),
    0,
  );

  return {
    totalCourses: paths.length,
    completedCourses: completed,
    inProgress,
    totalMinutes,
    totalHours: Math.floor(totalMinutes / 60),
    longestStreak: maxStreak,
    subscription: { plan: sub.plan, status: sub.status },
  };
};

module.exports = {
  getPlans,
  getMySubscription,
  getCourses,
  getCourseDetail,
  enrollCourse,
  getMyPaths,
  getMyPath,
  getLessonContent,
  startTutorSession,
  sendTutorMessage,
  completeTutorSession,
  getQuiz,
  submitQuiz,
  syllabusChat,
  getStats,
};
