// ================================================================
// SEED COURSES — run once to populate the course catalogue
// Usage: node src/scripts/seed_courses.js
// ================================================================
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Course = require("../models/Course");

// We need Course model — require after DB connects
const COURSES = [
  {
    title: "Onion Farming A-Z",
    titleMr: "कांदा शेती संपूर्ण मार्गदर्शन",
    titleHi: "प्याज की खेती A से Z",
    description:
      "Complete guide to onion farming — soil prep to market selling.",
    category: "CROP_MANAGEMENT",
    targetCrops: ["onion"],
    difficulty: "BEGINNER",
    targetAudience: "BEGINNER",
    estimatedHours: 4,
    isPublished: true,
    createdBy: "ADMIN",
    modules: [
      {
        title: "Soil Preparation",
        titleMr: "माती तयारी",
        sequence: 1,
        lessons: [
          {
            title: "Understanding Soil for Onion Farming",
            titleMr: "कांद्यासाठी माती समजून घ्या",
            sequence: 1,
            type: "THEORY",
            aiPrompt:
              "Teach about ideal soil for onion farming in Maharashtra. Cover: soil type (sandy loam), pH range (6.0-7.0), organic matter importance, how to test soil at home, how to correct pH with lime or sulfur. Use Nashik/Pune region examples.",
            assignment: {
              task: "Collect soil from 3 spots in your field. Feel the texture — is it sandy, clay, or loam?",
              taskMr:
                "तुमच्या शेतातून ३ ठिकाणांची माती घ्या. पोत तपासा — वाळूसारखी, चिकट की मध्यम?",
            },
            estimatedMinutes: 15,
            isPublished: true,
          },
          {
            title: "Composting and Organic Matter",
            titleMr: "कंपोस्ट आणि सेंद्रिय पदार्थ",
            sequence: 2,
            type: "PRACTICAL",
            aiPrompt:
              "Teach how to make and use compost for onion farming. Cover: why organic matter matters for onion quality, how to make a simple compost pit, when and how much to apply, FYM dosage per acre.",
            estimatedMinutes: 20,
            isPublished: true,
          },
        ],
      },
      {
        title: "Variety Selection & Sowing",
        titleMr: "वाण निवड आणि पेरणी",
        sequence: 2,
        lessons: [
          {
            title: "Choosing the Right Onion Variety",
            titleMr: "योग्य कांद्याचे वाण निवडा",
            sequence: 1,
            type: "THEORY",
            aiPrompt:
              "Teach about onion varieties for Maharashtra. Cover: Bhima Kiran, Bhima Raj, Agrifound Light Red (kharif), Bhima Super (rabi). Which variety for which season and market. Storage life of each variety.",
            estimatedMinutes: 15,
            isPublished: true,
          },
          {
            title: "Nursery Preparation and Transplanting",
            titleMr: "रोपवाटिका आणि पुनर्लागवड",
            sequence: 2,
            type: "PRACTICAL",
            aiPrompt:
              "Teach nursery preparation for onion seedlings and transplanting. Cover: nursery bed preparation, seed treatment with Thiram, when seedlings are ready (5-6 weeks, 15cm tall), spacing (15x10cm), how to transplant without damaging roots.",
            estimatedMinutes: 25,
            isPublished: true,
          },
        ],
      },
      {
        title: "Irrigation & Fertilizers",
        titleMr: "पाणी व्यवस्थापन आणि खते",
        sequence: 3,
        lessons: [
          {
            title: "Irrigation Schedule for Onion",
            sequence: 1,
            type: "THEORY",
            aiPrompt:
              "Teach irrigation management for onion crop. Cover: critical water stages, drip vs furrow irrigation, water requirement per week, how to identify over/under watering, stopping irrigation 2 weeks before harvest.",
            estimatedMinutes: 15,
            isPublished: true,
          },
          {
            title: "Fertilizer Schedule — NPK for Onion",
            sequence: 2,
            type: "THEORY",
            aiPrompt:
              "Teach complete fertilizer management for onion. Cover: basal dose (40kg Urea + 250kg SSP + 50kg MOP per acre), top dressing at 30 and 60 days, micronutrients (Boron), fertigation through drip, signs of nutrient deficiency.",
            estimatedMinutes: 20,
            isPublished: true,
          },
        ],
      },
    ],
  },

  {
    title: "Organic Farming for Beginners",
    titleMr: "सेंद्रिय शेती - नवख्यांसाठी",
    titleHi: "जैविक खेती शुरुआती गाइड",
    description:
      "Start your organic farming journey — no chemicals, better prices.",
    category: "ORGANIC_FARMING",
    targetCrops: [],
    difficulty: "BEGINNER",
    targetAudience: "ALL",
    estimatedHours: 5,
    isPublished: true,
    createdBy: "ADMIN",
    modules: [
      {
        title: "Why Organic?",
        sequence: 1,
        lessons: [
          {
            title: "Understanding Organic Farming",
            sequence: 1,
            type: "THEORY",
            aiPrompt:
              "Teach why organic farming is important in Maharashtra. Cover: soil health degradation from chemical overuse, premium prices for organic produce (20-50% more), PGS-India certification for small farmers, which crops get best organic premium.",
            estimatedMinutes: 20,
            isPublished: true,
          },
          {
            title: "Making Jeevamrut — Liquid Biofertilizer",
            sequence: 2,
            type: "PRACTICAL",
            aiPrompt:
              "Teach how to make Jeevamrut at home. Cover: ingredients (cow dung 10kg, cow urine 10L, jaggery 2kg, gram flour 2kg, water 200L), preparation method, fermentation 48 hours, how to apply, cost comparison vs chemical fertilizers.",
            assignment: {
              task: "Try making a small 20L batch of Jeevamrut this week.",
              taskMr: "या आठवड्यात छोटी २०L जीवामृत बनवण्याचा प्रयत्न करा.",
            },
            estimatedMinutes: 25,
            isPublished: true,
          },
        ],
      },
    ],
  },

  {
    title: "Drip Irrigation — Setup & Management",
    titleMr: "ठिबक सिंचन - बसवणे आणि व्यवस्थापन",
    titleHi: "ड्रिप सिंचाई — स्थापना और प्रबंधन",
    description: "Save 50% water and increase yield with drip irrigation.",
    category: "IRRIGATION",
    targetCrops: [],
    difficulty: "INTERMEDIATE",
    targetAudience: "ALL",
    estimatedHours: 3,
    isPublished: true,
    createdBy: "ADMIN",
    modules: [
      {
        title: "Drip System Basics",
        sequence: 1,
        lessons: [
          {
            title: "How Drip Irrigation Works",
            sequence: 1,
            type: "THEORY",
            aiPrompt:
              "Teach how drip irrigation systems work for Indian farmers. Cover: components (mainline, submain, laterals, drippers, filters), pressure requirements, government subsidy (55-80% in Maharashtra — NHM scheme), cost per acre installation.",
            estimatedMinutes: 20,
            isPublished: true,
          },
        ],
      },
    ],
  },

  {
    title: "Government Schemes for Farmers",
    titleMr: "शेतकऱ्यांसाठी सरकारी योजना",
    titleHi: "किसानों के लिए सरकारी योजनाएं",
    description:
      "Know your rights — all major central and state schemes explained simply.",
    category: "GOVT_SCHEMES",
    targetCrops: [],
    difficulty: "EASY",
    targetAudience: "ALL",
    estimatedHours: 2,
    isPublished: true,
    createdBy: "ADMIN",
    modules: [
      {
        title: "Central Government Schemes",
        sequence: 1,
        lessons: [
          {
            title: "PM-KISAN — ₹6,000 Every Year",
            sequence: 1,
            type: "THEORY",
            aiPrompt:
              "Teach PM-KISAN scheme in detail. Cover: ₹6000/year in 3 installments, eligibility, how to apply (CSC or pmkisan.gov.in), documents needed, how to check status, what to do if installment is stuck, helpline 155261.",
            estimatedMinutes: 15,
            isPublished: true,
          },
          {
            title: "PM Fasal Bima — Crop Insurance",
            sequence: 2,
            type: "THEORY",
            aiPrompt:
              "Teach PMFBY crop insurance. Cover: what it covers, premium rates (2% kharif, 1.5% rabi), how to apply, deadlines (31 July kharif, 31 Dec rabi), 72-hour damage reporting rule, helpline 14447, how to claim.",
            estimatedMinutes: 20,
            isPublished: true,
          },
        ],
      },
    ],
  },

  {
    title: "Soil Health & Fertilizer Management",
    titleMr: "मातीचे आरोग्य आणि खत व्यवस्थापन",
    titleHi: "मिट्टी स्वास्थ्य और उर्वरक प्रबंधन",
    description: "Understand your soil and fertilize smarter, not more.",
    category: "SOIL_HEALTH",
    targetCrops: [],
    difficulty: "INTERMEDIATE",
    targetAudience: "ALL",
    estimatedHours: 3,
    isPublished: true,
    createdBy: "ADMIN",
    modules: [
      {
        title: "Soil Testing",
        sequence: 1,
        lessons: [
          {
            title: "How to Get Your Soil Tested",
            sequence: 1,
            type: "PRACTICAL",
            aiPrompt:
              "Teach soil testing for Maharashtra farmers. Cover: why test (save money on fertilizers), where to test (KVK, soil testing lab), Soil Health Card scheme (free), how to collect sample correctly (10 spots mixed), how to read the report (NPK, pH, EC, organic carbon).",
            estimatedMinutes: 20,
            isPublished: true,
          },
        ],
      },
    ],
  },

  {
    title: "Cattle Health Management",
    titleMr: "जनावरांचे आरोग्य व्यवस्थापन",
    titleHi: "पशु स्वास्थ्य प्रबंधन",
    description: "Keep your cattle healthy, productive and disease-free.",
    category: "CATTLE",
    targetCrops: [],
    difficulty: "BEGINNER",
    targetAudience: "ALL",
    estimatedHours: 4,
    isPublished: true,
    createdBy: "ADMIN",
    modules: [
      {
        title: "Daily Health Monitoring",
        sequence: 1,
        lessons: [
          {
            title: "How to Monitor Your Cattle Daily",
            sequence: 1,
            type: "PRACTICAL",
            aiPrompt:
              "Teach farmers how to do a daily cattle health check in 5 minutes. Cover: temperature check (normal 38-39.5°C), eye and nose check, appetite and rumination, milk yield monitoring, hoof inspection, when to call a vet. Practical for 2-5 animals.",
            estimatedMinutes: 20,
            isPublished: true,
          },
          {
            title: "Vaccination Schedule for Cattle",
            sequence: 2,
            type: "THEORY",
            aiPrompt:
              "Teach essential vaccination schedule for cattle in Maharashtra. Cover: FMD (every 6 months), HS (annual), BQ (annual), Brucellosis (female calves once), Theileria, government free vaccination camps, how to maintain vaccination records.",
            estimatedMinutes: 15,
            isPublished: true,
          },
        ],
      },
    ],
  },
];

const seed = async () => {
  try {
    await connectDB();

    console.log("=".repeat(60));
    console.log("  Seeding KrishiMitra Course Catalogue");
    console.log("=".repeat(60));

    let inserted = 0;
    let skipped = 0;

    for (const courseData of COURSES) {
      const existing = await Course.findOne({ title: courseData.title });

      if (existing) {
        console.log(`  ⏭️  Skipped (exists): ${courseData.title}`);
        skipped++;
        continue;
      }

      const course = await Course.create(courseData);
      const lessonCount = course.modules.reduce(
        (sum, m) => sum + m.lessons.length,
        0,
      );
      console.log(
        `  ✅ Inserted: ${course.title} (${course.modules.length} modules, ${lessonCount} lessons)`,
      );
      inserted++;
    }

    console.log("\n" + "=".repeat(60));
    console.log(`  Done! ${inserted} inserted, ${skipped} skipped.`);
    console.log("  Lesson content is generated by Gemini on first request.");
    console.log("=".repeat(60));
  } catch (err) {
    console.error("Seed failed:", err.message);
  } finally {
    await mongoose.connection.close();
    console.log("DB connection closed.");
    process.exit(0);
  }
};

seed();
