# ================================================================
# SEED KNOWLEDGE BASE
# Run this ONCE to populate Pinecone with initial farming knowledge.
# After this, admins can add more via the /rag/ingest endpoints.
#
# Usage: python seed_knowledge.py
# ================================================================
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.rag_service import ingest_text

KNOWLEDGE = [
    # ── Onion crop knowledge ──────────────────────────────────
    {
        "title":    "Onion Thrips Management",
        "category": "crop_disease",
        "language": "mr",
        "content":  """
कांद्यावरील फुलकिडे (Thrips) व्यवस्थापन

लक्षणे:
फुलकिडे कांद्याच्या पानांवर चांदीसारखे पांढरे डाग करतात. पाने वाकडी होतात व पिवळी पडतात. जास्त आक्रमणात पीक करपल्यासारखे दिसते.

नुकसान:
फुलकिड्यांमुळे उत्पादनात ३०-५०% घट होऊ शकते. दमट व उष्ण वातावरणात प्रादुर्भाव जास्त होतो.

प्रतिबंधक उपाय:
१. शेतात निळे/पिवळे चिकट सापळे लावा (प्रति एकर ५-६ सापळे).
२. पिकाची दाटी टाळा - हवा खेळती राहू द्या.
३. लसूण किंवा कडुनिंबाचा अर्क फवारणे फायदेशीर आहे.
४. रोपे लावण्यापूर्वी थायमेथोक्झाम (Thiamethoxam) ने बीज प्रक्रिया करा.

रासायनिक नियंत्रण:
स्पिनोसॅड (Spinosad) किंवा इमामेक्टिन बेंझोएट (Emamectin Benzoate) क्रिषी केंद्राच्या सल्ल्याने फवारावे. फवारणी सकाळी किंवा संध्याकाळी करावी.

आर्थिक नुकसान पातळी:
पानामागे ५ पेक्षा जास्त फुलकिडे दिसल्यास फवारणी आवश्यक आहे.
        """,
    },
    {
        "title":    "Onion Purple Blotch Disease",
        "category": "crop_disease",
        "language": "mr",
        "content":  """
कांद्याचा जांभळा डाग रोग (Purple Blotch)

कारण: Alternaria porri नावाची बुरशी

लक्षणे:
पानांवर छोटे पांढरट ठिपके येतात, नंतर जांभळे-तपकिरी होतात. डागांभोवती पिवळी किनार असते. ओलसर वातावरणात डाग झपाट्याने वाढतात.

अनुकूल परिस्थिती:
तापमान ११-३७°C, आर्द्रता ८०% पेक्षा जास्त. पावसाळ्यात जास्त प्रादुर्भाव.

व्यवस्थापन:
१. रोगग्रस्त पाने तोडून नष्ट करा.
२. जास्त पाणी देणे टाळा. ठिबक सिंचन वापरा.
३. मॅन्कोझेब (Mancozeb 75% WP) - २.५ ग्रॅम प्रति लिटर पाण्यात मिसळून फवारा.
४. किंवा कॉपर ऑक्सीक्लोराइड - ३ ग्रॅम प्रति लिटर पाण्यात फवारा.
५. फवारणी आठवड्यातून एकदा करा, ओला हंगाम असल्यास.

प्रतिबंध:
पिकाची फेरपालट करा - एकाच शेतात सतत कांदा लावू नका. तीन वर्षांत एकदा फेरपालट करा.
        """,
    },

    # ── Government schemes ────────────────────────────────────
    {
        "title":    "PM-Kisan Samman Nidhi Yojana",
        "category": "scheme",
        "language": "mr",
        "content":  """
पंतप्रधान किसान सन्मान निधी योजना (PM-KISAN)

काय मिळते:
शेतकऱ्यांना दरवर्षी ₹६,000 रुपये तीन हप्त्यांत (प्रत्येक ₹२,000) थेट बँक खात्यात मिळतात.

पात्रता:
- शेतजमीन असलेला कोणताही शेतकरी पात्र आहे
- आधार कार्ड असणे आवश्यक आहे
- सरकारी नोकरदार, आयकर भरणारे पात्र नाहीत

अर्ज कसा करायचा:
१. जवळच्या CSC (Common Service Centre) केंद्रात जा
२. किंवा pmkisan.gov.in वेबसाइटवर स्वतः नोंदणी करा
३. आधार, बँक पासबुक, जमीन कागदपत्रे सोबत न्या

हप्ते:
- एप्रिल-जुलै: पहिला हप्ता
- ऑगस्ट-नोव्हेंबर: दुसरा हप्ता
- डिसेंबर-मार्च: तिसरा हप्ता

तक्रार:
हप्ता न मिळाल्यास: pmkisan.gov.in वर "Know Your Status" तपासा किंवा हेल्पलाइन 155261 वर कॉल करा.
        """,
    },
    {
        "title":    "Pradhan Mantri Fasal Bima Yojana - Crop Insurance",
        "category": "scheme",
        "language": "mr",
        "content":  """
प्रधानमंत्री फसल बिमा योजना (PMFBY) - पीक विमा

काय आहे:
नैसर्गिक आपत्ती, कीड-रोग, गारपीट यामुळे नुकसान झाल्यास शेतकऱ्यांना नुकसान भरपाई मिळते.

प्रीमियम (हप्ता):
- खरीप पिके: फक्त २% प्रीमियम शेतकऱ्याने भरायचे
- रब्बी पिके: फक्त १.५% प्रीमियम
- बागायती: ५%

उदाहरण: कांदा विमा ₹१ लाख असेल तर शेतकऱ्याला फक्त ₹५,000 द्यायचे.

कसा अर्ज करायचा:
खरीप हंगामासाठी: ३१ जुलैपूर्वी
रब्बी हंगामासाठी: ३१ डिसेंबरपूर्वी
- जवळच्या बँक शाखेत जा
- किंवा CSC केंद्रात जा
- आधार, बँक पासबुक, ७/१२ उतारा सोबत न्या

नुकसान झाल्यावर:
७२ तासांत कृषी विभाग किंवा विमा कंपनीला कळवा. फोन: 14447 (टोल फ्री)
        """,
    },

    # ── Fertilizer knowledge ──────────────────────────────────
    {
        "title":    "NPK Fertilizer Guide for Maharashtra Crops",
        "category": "fertilizer",
        "language": "en",
        "content":  """
NPK Fertilizer Recommendations for Common Maharashtra Crops

ONION (per acre):
- Basal (at planting): 40kg Urea + 250kg SSP + 50kg MOP
- Top dressing at 30 days: 40kg Urea
- Top dressing at 60 days: 40kg Urea
- Total N:P:K = 50:50:30 kg/acre

TOMATO (per acre):
- Basal: 50kg DAP + 50kg MOP
- Top dressing 1 (15 days): 30kg Urea
- Top dressing 2 (30 days): 30kg Urea
- Top dressing 3 (fruiting): 25kg MOP
- Total N:P:K = 80:80:60 kg/acre

WHEAT (per acre):
- Basal: 50kg DAP + 20kg MOP
- Top dressing (20 days after sowing): 55kg Urea (only if irrigated)
- Total N:P:K = 60:30:20 kg/acre

SOYBEAN (per acre):
- Basal only: 25kg DAP + 20kg MOP (soybean fixes its own nitrogen)
- Seed treatment: Rhizobium culture (200g per 10kg seed)
- Total N:P:K = 10:50:30 kg/acre

IMPORTANT NOTES:
- Never apply fertilizer to dry soil — irrigate first
- Split urea applications give better results than single dose
- Soil testing every 3 years helps optimize fertilizer use
- Over-fertilization causes lodging (plants falling) and poor quality
        """,
    },

    # ── Pest management ───────────────────────────────────────
    {
        "title":    "Integrated Pest Management for Soybean",
        "category": "crop_disease",
        "language": "mr",
        "content":  """
सोयाबीनचे एकात्मिक कीड व्यवस्थापन

प्रमुख कीड:

१. हेलिकोव्हर्पा (घाटे अळी):
लक्षणे: शेंगा आतून खाते, फुले गळतात.
नियंत्रण: एचएएनपीव्ही विषाणू (HNPV) फवारा - पर्यावरणस्नेही उपाय.

२. पांढरी माशी (Whitefly):
लक्षणे: पाने पिवळी पडतात, पिवळा मोझेक विषाणू पसरतो.
नियंत्रण: निळे चिकट सापळे लावा. थायमेथोक्झाम फवारा.

३. खोडकिडा (Stem borer):
लक्षणे: खोड आतून खाते, झाड वाळते.
नियंत्रण: कार्बोफ्युरान (Carbofuran 3G) - ५ किलो प्रति एकर जमिनीत मिसळा.

एकात्मिक उपाय:
- शेतात पक्ष्यांसाठी काठ्या लावा (प्रति एकर ४-५) - पक्षी अळ्या खातात
- फेरोमोन सापळे लावा (प्रति एकर २)
- पीक आलटून पालटून लावा

महत्त्वाचे: कीटकनाशक वापरण्यापूर्वी कृषी अधिकाऱ्याचा सल्ला घ्या.
        """,
    },

    # ── Irrigation knowledge ──────────────────────────────────
    {
        "title":    "Drip Irrigation for Onion and Vegetables",
        "category": "technique",
        "language": "mr",
        "content":  """
कांदा व भाजीपाल्यासाठी ठिबक सिंचन

फायदे:
- ४०-५०% पाण्याची बचत
- खते थेट मुळांपर्यंत पोहोचतात (फर्टिगेशन)
- रोग कमी होतात - पाने ओली राहत नाहीत
- उत्पादन १५-२०% जास्त मिळते

सेटअप कसा करायचा:
- लॅटरल पाइप: ४५ सेमी अंतरावर
- ड्रिपर: ३०-४५ सेमी अंतरावर, ४ लिटर/तास क्षमता
- फिल्टर: मेश फिल्टर आवश्यक - महिन्यातून एकदा साफ करा

पाणी वेळापत्रक (कांदा):
- रोपे लावल्यानंतर: दररोज ३०-४५ मिनिटे
- वाढीचा काळ: एकाआड एक दिवस, ४५ मिनिटे
- बल्ब तयार होताना: आठवड्यातून ३ वेळा
- काढणीच्या २ आठवडे आधी: पाणी बंद करा

अनुदान:
राज्य सरकार ठिबक सिंचनावर ५५-८०% अनुदान देते.
कृषी विभागात अर्ज करा: अनुदानाचे पैसे थेट बँकेत जमा होतात.
        """,
    },
]


async def main():
    print("=" * 60)
    print("  Seeding KrishiMitra Knowledge Base")
    print("  This will take 2-3 minutes (embedding each document)")
    print("=" * 60)

    total_chunks = 0
    for i, item in enumerate(KNOWLEDGE, 1):
        print(f"\n[{i}/{len(KNOWLEDGE)}] Ingesting: '{item['title']}'...")
        try:
            result = await ingest_text(
                content  = item["content"],
                title    = item["title"],
                category = item["category"],
                language = item["language"],
                source   = "KrishiMitra Initial Knowledge Base v1.0",
            )
            total_chunks += result["chunks_stored"]
            print(f"    ✅ {result['chunks_stored']} chunks stored")
        except Exception as e:
            print(f"    ❌ Failed: {e}")

    print(f"\n{'='*60}")
    print(f"  Seeding complete! {total_chunks} total chunks in Pinecone.")
    print(f"  The AI chatbot can now answer questions about:")
    print(f"  - Onion thrips and purple blotch disease")
    print(f"  - PM-KISAN and crop insurance schemes")
    print(f"  - NPK fertilizer recommendations")
    print(f"  - Soybean pest management")
    print(f"  - Drip irrigation setup")
    print(f"\n  Add more knowledge via: POST /rag/ingest/text or /rag/ingest/pdf")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())