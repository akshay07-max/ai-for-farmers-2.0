# ================================================================
# SHETI MITRA TUTOR SERVICE
# The AI teaching character — friendly farming companion.
# Handles all AI generation for the learning module:
#   - Lesson content generation (cached)
#   - Live teaching sessions (conversational)
#   - Quiz generation + evaluation
#   - Syllabus building conversation
# ================================================================
import logging
from config import gemini_client, GEMINI_MODEL

logger = logging.getLogger(__name__)

# ── Sheti Mitra personality prompt ───────────────────────────────────────────
# This is injected into every teaching interaction.
SHETI_MITRA_PERSONA = """You are Sheti Mitra (शेती मित्र), an AI farming companion and teacher.

YOUR PERSONALITY:
- You are warm, patient, and encouraging — like a knowledgeable friend, not a textbook
- You speak in simple, everyday language — never use jargon without explaining it
- You use local examples: Nashik onions, Marathwada cotton, Vidarbha soybean
- You celebrate small wins: "शाब्बास! (Well done!)", "अगदी बरोबर! (Exactly right!)"
- You never make the farmer feel stupid — every question is a good question
- You connect every concept to the farmer's actual situation

YOUR LANGUAGE RULES:
- ALWAYS respond in the EXACT language specified (mr=Marathi, hi=Hindi, en=English)
- For Marathi: use conversational Marathi, not formal/written style
- For technical terms: say the local name first, then explain: "करपा रोग (blight)"
- Keep sentences short — farmers read on small phone screens

YOUR TEACHING STYLE:
- Teach in small chunks — one concept at a time
- Use analogies from daily rural life
- Always give a practical "try this today" takeaway
- After explaining, check understanding: "हे समजलं का?" / "Kya samjhe?" / "Did you get that?"

WHAT YOU NEVER DO:
- Never give generic advice — always specific to their crops and region
- Never use bullet points with special characters — use simple numbered lists
- Never be preachy or lecture-like
- Never say "As an AI..." — you ARE Sheti Mitra, a trusted companion
"""

# ── Language helpers ──────────────────────────────────────────────────────────
LANG_NAMES = {"mr": "Marathi", "hi": "Hindi", "en": "English"}

STAGE_TRANSITIONS = {
    "mr": {
        "checking_prompt": "आता मला सांगा",
        "understood":      "समजलं!",
        "well_done":       "शाब्बास!",
        "next_topic":      "आता पुढे जाऊया",
        "summary_intro":   "आज आपण काय शिकलो त्याचा आढावा घेऊया",
        "assignment_intro":"आजचे व्यावहारिक काम",
    },
    "hi": {
        "checking_prompt": "अब मुझे बताइए",
        "understood":      "समझ गए!",
        "well_done":       "शाबाश!",
        "next_topic":      "अब आगे बढ़ते हैं",
        "summary_intro":   "आज हमने क्या सीखा उसका सारांश लेते हैं",
        "assignment_intro":"आज का व्यावहारिक काम",
    },
    "en": {
        "checking_prompt": "Now tell me",
        "understood":      "Got it!",
        "well_done":       "Well done!",
        "next_topic":      "Let's move on",
        "summary_intro":   "Let's recap what we learned today",
        "assignment_intro":"Today's practical task",
    },
}


def _call_gemini(prompt: str, history: list = None) -> str:
    """Make a Gemini API call, return text response."""
    if not gemini_client:
        return "AI service not available. Please check your API key."

    try:
        from google.genai import types

        contents = []
        if history:
            for msg in history:
                role = "model" if msg["role"] in ("tutor", "model", "assistant") else "user"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        contents.append({"role": "user", "parts": [{"text": prompt}]})

        response = gemini_client.models.generate_content(
            model    = GEMINI_MODEL,
            contents = contents,
            config   = types.GenerateContentConfig(
                temperature       = 0.6,
                max_output_tokens = 800,
            ),
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini call failed: {e}")
        raise RuntimeError(f"AI generation failed: {str(e)}")


# ══════════════════════════════════════════════════════════════════════════════
# LESSON CONTENT GENERATION
# ══════════════════════════════════════════════════════════════════════════════

async def generate_lesson_content(
    ai_prompt: str,
    language:  str,
    farmer_context: dict = None
) -> str:
    """
    Generate full lesson content for a given topic.
    Called once per lesson per language — result cached in MongoDB.

    Args:
        ai_prompt:       What the admin wrote as lesson topic/instructions
        language:        "mr" | "hi" | "en"
        farmer_context:  Optional { district, primaryCrops } for personalization
    """
    lang_name = LANG_NAMES.get(language, "English")

    context_str = ""
    if farmer_context:
        crops    = ", ".join(farmer_context.get("primaryCrops", []))
        district = farmer_context.get("district", "Maharashtra")
        if crops:
            context_str = f"\nMake examples specific to {crops} farming in {district}."

    prompt = f"""{SHETI_MITRA_PERSONA}

Generate a complete farming lesson in {lang_name}.
Topic: {ai_prompt}{context_str}

Structure the lesson as:
1. Opening hook (1-2 sentences connecting to farmer's daily life)
2. Main concept explained simply (3-4 paragraphs, one idea each)
3. Local examples and practical tips
4. Common mistakes to avoid
5. Key takeaway (1 sentence)

Write in conversational {lang_name} as if teaching face-to-face.
Total length: 400-600 words.
Do NOT use markdown headers or bullet symbols — use plain numbered lists."""

    return _call_gemini(prompt)


# ══════════════════════════════════════════════════════════════════════════════
# LIVE TUTOR SESSION
# ══════════════════════════════════════════════════════════════════════════════

async def start_session(
    lesson_title:    str,
    lesson_content:  str,
    language:        str,
    farmer_name:     str,
    farmer_context:  dict = None,
) -> dict:
    """
    Generate Sheti Mitra's opening message for a live lesson.
    Returns: { message, stage, teaching_state }
    """
    lang_name = LANG_NAMES.get(language, "English")
    crops     = ", ".join((farmer_context or {}).get("primaryCrops", ["farming"]))
    district  = (farmer_context or {}).get("district", "your area")

    prompt = f"""{SHETI_MITRA_PERSONA}

You are starting a live teaching session in {lang_name}.
Farmer's name: {farmer_name}
Their crops: {crops}
Their district: {district}
Lesson topic: {lesson_title}

Write ONLY the opening message (2-3 sentences):
1. Greet by name warmly
2. Connect the lesson to THEIR specific farming situation
3. Tell them what they'll be able to DO after this lesson (practical outcome)
4. End with an invitation: ask if they're ready to start

Be warm and conversational. This is the INTRO stage."""

    message = _call_gemini(prompt)

    # Split lesson content into 3-4 teaching chunks
    words  = lesson_content.split()
    chunk_size = max(80, len(words) // 3)
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunks.append(" ".join(words[i:i + chunk_size]))

    return {
        "message":       message,
        "stage":         "INTRO",
        "teaching_state":{ "chunkIndex": 0, "totalChunks": len(chunks), "chunks": chunks },
    }


async def continue_session(
    farmer_message:  str,
    session_history: list,
    lesson_content:  str,
    teaching_state:  dict,
    stage:           str,
    language:        str,
    farmer_context:  dict = None,
) -> dict:
    """
    Continue a live tutoring session based on farmer's message.
    Advances through INTRO → TEACHING → CHECKING → SUMMARY → DONE.

    Returns: { message, stage, teaching_state, completed }
    """
    lang_name = LANG_NAMES.get(language, "Marathi")
    phrases   = STAGE_TRANSITIONS.get(language, STAGE_TRANSITIONS["en"])
    chunks    = teaching_state.get("chunks", [lesson_content])
    chunk_idx = teaching_state.get("chunkIndex", 0)
    total     = teaching_state.get("totalChunks", 1)

    # ── Detect if farmer said they don't understand ───────────
    confused_signals = {
        "mr": ["नाही", "समजलं नाही", "कळलं नाही", "परत", "पुन्हा"],
        "hi": ["नहीं", "समझ नहीं", "फिर से", "दोबारा"],
        "en": ["no", "don't understand", "confused", "again", "repeat"],
    }
    farmer_confused = any(
        sig in farmer_message.lower()
        for sig in confused_signals.get(language, [])
    )

    # ── Build context for Gemini ──────────────────────────────
    history_text = "\n".join([
        f"{'Sheti Mitra' if m['role'] == 'tutor' else 'Farmer'}: {m['content']}"
        for m in session_history[-6:]  # last 6 messages for context
    ])

    # ── Stage logic ───────────────────────────────────────────
    if stage == "INTRO":
        # Farmer confirmed ready — start first teaching chunk
        current_chunk = chunks[0] if chunks else lesson_content
        prompt = f"""{SHETI_MITRA_PERSONA}
Conversation so far:
{history_text}

Farmer just said: "{farmer_message}"
They're ready to learn. Now teach the FIRST concept.

Teaching content for this chunk:
{current_chunk}

In {lang_name}:
- Teach this concept in 3-4 simple sentences
- Use a local farming analogy
- End with: "{phrases['checking_prompt']}, [ask one simple question to check understanding]"
Stage: TEACHING"""

        new_chunk_idx = 1
        new_stage     = "TEACHING"

    elif stage == "TEACHING":
        if farmer_confused:
            # Re-explain differently
            current_chunk = chunks[max(0, chunk_idx - 1)]
            prompt = f"""{SHETI_MITRA_PERSONA}
Conversation so far:
{history_text}

Farmer said they didn't understand: "{farmer_message}"

Re-explain this concept in {lang_name} using a DIFFERENT simpler analogy:
{current_chunk}

Use an analogy from rural daily life (cooking, weather, animals).
Keep it to 3 sentences. Then ask if they understand now."""
            new_chunk_idx = chunk_idx  # don't advance
            new_stage     = "TEACHING"

        elif chunk_idx < total - 1:
            # Advance to next chunk
            current_chunk = chunks[chunk_idx] if chunk_idx < len(chunks) else ""
            prompt = f"""{SHETI_MITRA_PERSONA}
Conversation so far:
{history_text}

Farmer's response: "{farmer_message}"
Good response! Now teach the NEXT concept.

Next teaching content:
{current_chunk}

In {lang_name}:
- Acknowledge their response briefly ("{phrases['understood']}")
- Teach the next concept (3-4 sentences)  
- Connect it to what they just learned
- End with a comprehension check question"""
            new_chunk_idx = chunk_idx + 1
            new_stage     = "TEACHING"

        else:
            # All chunks done — move to checking
            prompt = f"""{SHETI_MITRA_PERSONA}
Conversation so far:
{history_text}

Farmer's response: "{farmer_message}"
All teaching content covered. Now CHECK their understanding.

Full lesson context:
{lesson_content[:500]}

In {lang_name}:
- Say "{phrases['well_done']}" and acknowledge they've covered all the content
- Ask ONE open-ended comprehension question that requires applying what they learned
- Make the question relevant to THEIR specific crops/situation"""
            new_chunk_idx = chunk_idx
            new_stage     = "CHECKING"

    elif stage == "CHECKING":
        # Evaluate their answer and move to summary
        prompt = f"""{SHETI_MITRA_PERSONA}
Conversation so far:
{history_text}

Farmer answered the comprehension question: "{farmer_message}"
Lesson content: {lesson_content[:400]}

In {lang_name}:
1. Evaluate their answer warmly (correct/partially correct/needs adjustment)
2. Add any missing key point briefly
3. Say "{phrases['summary_intro']}:"
4. Give 3 key takeaways as simple numbered points
5. Then give "{phrases['assignment_intro']}:" — one practical task they can do TODAY on their farm
6. End: "आजचा धडा पूर्ण झाला! 🌱" (or language equivalent)"""
        new_chunk_idx = chunk_idx
        new_stage     = "SUMMARY"

    elif stage == "SUMMARY":
        # Session complete
        prompt = f"""{SHETI_MITRA_PERSONA}
The lesson summary has been given.
Farmer's final message: "{farmer_message}"

In {lang_name}:
Write a warm closing (2 sentences):
- Congratulate them on completing the lesson
- Encourage them to do the practical assignment
- Tell them the next lesson is waiting when they're ready"""
        new_chunk_idx = chunk_idx
        new_stage     = "DONE"

    else:
        return {
            "message":       "Lesson already completed.",
            "stage":         "DONE",
            "teaching_state": teaching_state,
            "completed":     True,
        }

    message = _call_gemini(prompt, session_history[-4:])

    new_teaching_state = {
        **teaching_state,
        "chunkIndex": new_chunk_idx,
    }

    return {
        "message":        message,
        "stage":          new_stage,
        "teaching_state": new_teaching_state,
        "completed":      new_stage == "DONE",
    }


# ══════════════════════════════════════════════════════════════════════════════
# QUIZ GENERATION + EVALUATION
# ══════════════════════════════════════════════════════════════════════════════

async def generate_quiz(lesson_content: str, language: str, num_questions: int = 4) -> list:
    """
    Generate quiz questions from lesson content.
    Returns mix of MCQ and open-ended questions.
    """
    lang_name = LANG_NAMES.get(language, "English")

    prompt = f"""Based on this farming lesson content, generate {num_questions} quiz questions in {lang_name}.

Lesson content:
{lesson_content[:800]}

Generate exactly {num_questions} questions as a JSON array. Mix of MCQ and OPEN types.
Format:
[
  {{
    "type": "MCQ",
    "question": "question text in {lang_name}",
    "options": ["option1", "option2", "option3", "option4"],
    "correct": 1,
    "explanation": "why this is correct"
  }},
  {{
    "type": "OPEN",
    "question": "open ended question in {lang_name}",
    "evaluationCriteria": "key points the answer should contain"
  }}
]

Rules:
- Questions must be practical, not theoretical
- Test APPLICATION of knowledge, not memorization
- All text in {lang_name}
- Return ONLY the JSON array, no other text"""

    import json
    response = _call_gemini(prompt)

    try:
        # Strip any markdown code blocks if present
        clean = response.replace("```json", "").replace("```", "").strip()
        questions = json.loads(clean)
        return questions
    except json.JSONDecodeError:
        logger.error(f"Quiz JSON parse failed: {response[:200]}")
        # Return a simple fallback question
        return [{
            "type":     "OPEN",
            "question": "What was the most important thing you learned from this lesson?" if language == "en"
                        else "या धड्यातून तुम्हाला सर्वात महत्त्वाचे काय शिकायला मिळाले?",
            "evaluationCriteria": "Any relevant response about the lesson topic",
        }]


async def evaluate_open_answer(
    question:   str,
    answer:     str,
    criteria:   str,
    language:   str,
) -> dict:
    """
    Evaluate a farmer's open-ended quiz answer using Gemini.
    Returns { score (0-100), feedback, passed }
    """
    lang_name = LANG_NAMES.get(language, "English")

    prompt = f"""You are evaluating a farming student's quiz answer.

Question: {question}
Student's answer: {answer}
Evaluation criteria: {criteria}

Evaluate in {lang_name}. Return JSON:
{{
  "score": <0-100>,
  "passed": <true if score >= 60>,
  "feedback": "<2 sentences in {lang_name}: what they got right + what to remember>"
}}

Be encouraging. Partial credit for partial understanding.
Return ONLY the JSON object."""

    import json
    response = _call_gemini(prompt)
    try:
        clean  = response.replace("```json", "").replace("```", "").strip()
        result = json.loads(clean)
        return result
    except Exception:
        return {"score": 70, "passed": True, "feedback": "Good effort! Keep practicing."}


# ══════════════════════════════════════════════════════════════════════════════
# SYLLABUS BUILDER
# ══════════════════════════════════════════════════════════════════════════════

async def syllabus_chat(
    farmer_message:  str,
    conversation:    list,
    farmer_context:  dict,
    available_courses: list,
    language:        str,
) -> dict:
    """
    Conversational syllabus builder.
    Farmer tells AI what they want to learn → AI recommends course sequence.

    Returns: { message, recommended_courses (list of courseIds), ready_to_enroll }
    """
    lang_name = LANG_NAMES.get(language, "Marathi")
    crops     = ", ".join(farmer_context.get("primaryCrops", []))
    district  = farmer_context.get("district", "Maharashtra")

    courses_list = "\n".join([
        f"- {c['title']} (id: {c['id']}, category: {c['category']}, difficulty: {c['difficulty']})"
        for c in available_courses
    ])

    history_text = "\n".join([
        f"{'Sheti Mitra' if m['role'] == 'tutor' else 'Farmer'}: {m['content']}"
        for m in conversation[-6:]
    ])

    prompt = f"""{SHETI_MITRA_PERSONA}

You are helping a farmer build their personalized learning path in {lang_name}.

Farmer profile:
- Crops: {crops}
- District: {district}
- Experience: {farmer_context.get('experience', 'unknown')}

Available courses:
{courses_list}

Conversation so far:
{history_text}

Farmer just said: "{farmer_message}"

Your job:
1. Have a friendly conversation to understand their learning goals
2. Ask clarifying questions if needed (max 2 questions total across the conversation)
3. Once you understand their needs, recommend 2-3 courses in ORDER of learning
4. Explain WHY each course suits them specifically

When you have enough info to recommend, end your message with this exact tag:
[RECOMMENDATIONS: courseId1, courseId2, courseId3]

Respond in {lang_name}."""

    message  = _call_gemini(prompt, conversation[-4:])

    # Parse course recommendations if present
    recommended = []
    ready       = False
    if "[RECOMMENDATIONS:" in message:
        import re
        match = re.search(r'\[RECOMMENDATIONS:\s*([^\]]+)\]', message)
        if match:
            recommended = [r.strip() for r in match.group(1).split(",")]
            ready       = True
        # Remove the tag from the display message
        message = re.sub(r'\[RECOMMENDATIONS:[^\]]+\]', '', message).strip()

    return {
        "message":            message,
        "recommended_courses": recommended,
        "ready_to_enroll":    ready,
    }