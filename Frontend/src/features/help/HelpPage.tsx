import React, { useState, useMemo } from 'react';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { Card } from '../../components/ui/Card';
import {
  BookOpen,
  MapPin,
  TrendingUp,
  Award,
  BarChart3,
  Search,
  Sparkles,
  Coins,
  CheckCircle2,
  HelpCircle,
  Compass,
  Zap,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Store,
  Lightbulb
} from 'lucide-react';

type Language = 'en' | 'hi';
type Category = 'all' | 'rankings' | 'graphs' | 'keywords' | 'maps' | 'credits';

interface GuideCard {
  id: string;
  category: 'rankings' | 'graphs' | 'keywords' | 'maps' | 'credits';
  icon: React.ReactNode;
  en: {
    title: string;
    subtitle: string;
    summary: string;
    exampleScenario?: {
      businessName: string;
      keyword: string;
      description: string;
    };
    coreConcepts: {
      badge: string;
      badgeCls: string;
      title: string;
      description: string;
    }[];
    faqs: { q: string; a: string }[];
  };
  hi: {
    title: string;
    subtitle: string;
    summary: string;
    exampleScenario?: {
      businessName: string;
      keyword: string;
      description: string;
    };
    coreConcepts: {
      badge: string;
      badgeCls: string;
      title: string;
      description: string;
    }[];
    faqs: { q: string; a: string }[];
  };
}

const GUIDES_DATA: GuideCard[] = [
  {
    id: 'rankings-and-proximity',
    category: 'rankings',
    icon: <MapPin className="w-5 h-5 text-emerald-600" />,
    en: {
      title: 'Storefront Rank vs. City-Wide Grid (Why am I #1 here but not everywhere?)',
      subtitle: 'Understanding Google’s Proximity Engine & GeoGrid Distance Drop-off',
      summary: 'Google Maps ranks businesses heavily based on the physical distance between the searcher and the storefront. Ranking #1 at your doorstep does not mean customers 5 km away see you as #1.',
      exampleScenario: {
        businessName: 'Apex Dental Clinic (or City Coffee / Downtown Auto)',
        keyword: 'dentist near me',
        description: 'When a patient searches right in front of Apex Dental Clinic, Google shows them at Rank #1. But when a patient searches from 4 km away across town, Google displays clinics closer to that neighborhood, dropping Apex Dental Clinic to #7, #14, or 20+.',
      },
      coreConcepts: [
        {
          badge: 'Center Pin Rank (#1.0)',
          badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          title: 'Your Exact Storefront Rank',
          description: 'When someone stands right outside your store or within your immediate block, Google Maps displays your listing at position #1 (the green center pin).',
        },
        {
          badge: 'Avg Pos (ATRP: 15.0)',
          badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
          title: 'Average Total Rank Across Whole Grid',
          description: 'The mathematical mean across all 31 measured pins. Combining your #1 at the center with #5, #11, and #20+ at outer edges yields a realistic area-wide average of 15.0.',
        },
        {
          badge: 'Overall Position (#2 of 270)',
          badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
          title: 'City-Wide Market Leaderboard',
          description: 'Out of all 270 competing businesses discovered across the city in this 5 km scan, your profile ranks 2nd best overall in total market visibility.',
        },
        {
          badge: 'Rank Delta (e.g. ↑ +14)',
          badgeCls: 'bg-teal-50 text-teal-700 border-teal-200',
          title: 'Position Improvement Calculation',
          description: 'Calculated as Previous Rank minus Current Rank. Moving from position #19 up to position #5 yields a +14 position improvement.',
        },
      ],
      faqs: [
        {
          q: 'Why does my rank drop from #1 to #15 just 3 km away?',
          a: 'Google prioritizes local convenience. As a customer walks into an adjacent neighborhood, Google promotes businesses located in that neighborhood over yours. Expanding outward requires localized reviews mentioning surrounding areas and local directory citations.',
        },
        {
          q: 'Which number should I focus on most?',
          a: 'Focus on your Overall Market Standing (#2 of 270) and Visibility (SoLV %). They show your true competitive strength compared to every competitor in your market.',
        },
      ],
    },
    hi: {
      title: 'दुकान पर रैंक #1 और दूर जाने पर कम क्यों? (Proximity Effect)',
      subtitle: 'गूगल मैप्स की दूरी नीति और जियोग्रिड रैंकिंग का आसान विश्लेषण',
      summary: 'गूगल मैप्स ग्राहक और आपकी दुकान के बीच की दूरी को सबसे ज्यादा प्राथमिकता देता है। दुकान के पास #1 दिखने का मतलब यह नहीं कि 5 किमी दूर बैठा ग्राहक भी आपको #1 देखेगा।',
      exampleScenario: {
        businessName: 'उदाहरण: कोई भी क्लिनिक, कैफे, गैरेज या स्टोर (जैसे Apex Care Clinic)',
        keyword: 'clinic near me / store near me',
        description: 'जब कोई ग्राहक आपकी दुकान के ठीक सामने खड़ा होकर सर्च करता है, तो गूगल मैप्स आपको रैंक #1 दिखाता है। लेकिन जब वही ग्राहक 4 किमी दूर किसी दूसरे इलाके से सर्च करता है, तो गूगल उस इलाके की दूसरी दुकानों को ऊपर दिखाता है, जिससे आपकी रैंक #7, #14 या 20+ हो जाती है।',
      },
      coreConcepts: [
        {
          badge: 'सेंटर पिन रैंक (#1.0)',
          badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          title: 'दुकान के पते पर आपकी रैंक',
          description: 'जब कोई ग्राहक आपकी दुकान के ठीक पास या सामने खड़े होकर सर्च करता है, तो गूगल मैप्स आपको रैंक #1 (हरा सेंटर पिन) दिखाता है।',
        },
        {
          badge: 'एवरेज रैंक (ATRP: 15.0)',
          badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
          title: 'पूरे 5 किमी ग्रिड की औसत रैंक',
          description: 'मैप के सभी 31 पिनों का गणितीय औसत। सेंटर में #1 और बाहरी किनारों पर 5, 11 या 20+ को मिलाकर पूरे क्षेत्र का औसत 15.0 निकलता है।',
        },
        {
          badge: 'मार्केट लीडरबोर्ड (#2 of 270)',
          badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
          title: 'पूरे बाजार में आपकी स्थिति',
          description: 'इस 5 किमी के क्षेत्र में मिलीं सभी 270 प्रतिस्पर्धी दुकानों में से आपकी प्रोफाइल पूरे शहर में दूसरे स्थान (#2) पर सबसे मजबूत है।',
        },
        {
          badge: 'रैंक डेल्टा (जैसे ↑ +14)',
          badgeCls: 'bg-teal-50 text-teal-700 border-teal-200',
          title: 'रैंक में सुधार की गणना',
          description: 'पिछली रैंक में से नई रैंक घटाकर निकाला जाता है। रैंक 19 से 5 पर आना यानी +14 पोजीशन की सीधी तरक्की।',
        },
      ],
      faqs: [
        {
          q: 'दुकान से 3 किमी दूर जाते ही रैंक 1 से 15 क्यों हो जाती है?',
          a: 'गूगल ग्राहक की सुविधा देखता है। जैसे ही ग्राहक दूसरे मोहल्ले में जाता है, गूगल उस मोहल्ले की दुकानों को ऊपर दिखाता है। अपनी पहुंच बढ़ाने के लिए दूर के इलाकों के नाम वाले रिव्यू लें।',
        },
        {
          q: 'मुझे किस आंकड़े पर सबसे ज्यादा ध्यान देना चाहिए?',
          a: 'अपनी ओवरऑल मार्केट पोजीशन (#2 of 270) और विजिबिलिटी स्कोर (SoLV %) पर ध्यान दें, जो यह दिखाते हैं कि आप कंपटीटर्स से कितने आगे हैं।',
        },
      ],
    },
  },
  {
    id: 'sparkline-and-trend',
    category: 'graphs',
    icon: <TrendingUp className="w-5 h-5 text-blue-600" />,
    en: {
      title: 'How the Up/Down Graph (Sparkline) & Visibility Work',
      subtitle: 'Visualizing Historical Scans, Improvement Trends & Share of Local Voice',
      summary: 'The mini sparkline graph plots the rank movements of your keyword across recent scans. It instantly tells you whether your SEO efforts are pushing your listing up or if you are losing ground.',
      exampleScenario: {
        businessName: 'Generic Local Business Profile',
        keyword: 'best services near me',
        description: 'Suppose a business ranked #12 last month. After collecting 10 new customer reviews and updating photos, the next scan moved to #6, and now #3. The sparkline charts a climbing Green line showing steady upward momentum.',
      },
      coreConcepts: [
        {
          badge: 'Green Line (#22c55e)',
          badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          title: 'Positive Upward Trend',
          description: 'The green line indicates that your latest scan rank is better (closer to #1) than where you started in the current evaluation window.',
        },
        {
          badge: 'Red Line (#ef4444)',
          badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
          title: 'Downward Rank Movement',
          description: 'The red line warns you that your latest scan dropped in rank compared to previous scans, signaling competitor activity or review drops.',
        },
        {
          badge: 'Rolling 30-Scan Buffer',
          badgeCls: 'bg-slate-100 text-slate-700 border-slate-300',
          title: 'Chronological Memory',
          description: 'Every completed scan appends a point { date, rank }. The chart renders from left (earliest scan) to right (most recent scan).',
        },
        {
          badge: 'Visibility Bar (SoLV %)',
          badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
          title: 'Share of Local Voice',
          description: 'Measures what percentage of total local searchers in your 5 km area find your profile in Google’s Top 3 "Local 3-Pack". 80% represents dominant visibility.',
        },
      ],
      faqs: [
        {
          q: 'Why does the line show sharp zigzags?',
          a: 'Google Maps rankings fluctuate when competitors gain reviews, change business hours, or when Google runs local algorithm refreshes.',
        },
        {
          q: 'What is a good Visibility (SoLV) score?',
          a: 'Above 50% is solid local visibility; above 75% indicates top-tier dominance where almost all local searchers see your business first.',
        },
      ],
    },
    hi: {
      title: 'अप/डाउन स्पार्कलाइन ग्राफ और विजिबिलिटी कैसे काम करते हैं',
      subtitle: 'रैंक का उतार-चढ़ाव, ट्रेंड लाइन और शेयर ऑफ लोकल वॉइस (SoLV)',
      summary: 'छोटा स्पार्कलाइन ग्राफ यह दिखाता है कि पिछले कुछ स्कैनों में आपकी रैंक ऊपर गई है या नीचे। इससे एक नज़र में पता चल जाता है कि आपका लोकल एसईओ काम कर रहा है या नहीं।',
      exampleScenario: {
        businessName: 'उदाहरण: कोई भी स्थानीय स्टोर या क्लिनिक',
        keyword: 'best services near me',
        description: 'मान लीजिए किसी स्टोर की रैंक पिछले महीने #12 थी। नए रिव्यू मिलने के बाद अगले स्कैन में वह #6 पर आई और अब #3 पर पहुंच गई। ग्राफ में हरी ऊपर चढ़ती हुई लाइन दिखेगी जो ग्रोथ दर्शाती है।',
      },
      coreConcepts: [
        {
          badge: 'हरी लाइन (Green Line)',
          badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          title: 'रैंकिंग में लगातार सुधार',
          description: 'हरी लाइन का मतलब है कि आपकी ताजा रैंक पिछले स्कैन के मुकाबले बेहतर है और आप #1 की तरफ बढ़ रहे हैं।',
        },
        {
          badge: 'लाल लाइन (Red Line)',
          badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
          title: 'रैंकिंग में गिरावट का अलर्ट',
          description: 'लाल लाइन चेतावनी देती है कि आपकी रैंक पिछले स्कैन के मुकाबले गिरी है, शायद किसी कंपटीटर ने नए रिव्यू हासिल किए हैं।',
        },
        {
          badge: '30-स्कैन का इतिहास',
          badgeCls: 'bg-slate-100 text-slate-700 border-slate-300',
          title: 'समय के साथ प्रोग्रेस',
          description: 'हर स्कैन एक नया पॉइंट जोड़ता है। ग्राफ बाएं (पुराना स्कैन) से दाएं (ताजा स्कैन) की ओर चलता है।',
        },
        {
          badge: 'विजिबिलिटी बार (SoLV %)',
          badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
          title: 'लोकल मार्केट में हिस्सेदारी',
          description: 'यह प्रतिशत बताता है कि 5 किमी के इस दायरे में कितने लोग आपको गूगल के टॉप-3 "लोकल पैक" में देख पाते हैं। 80% का मतलब है जबरदस्त दबदबा।',
        },
      ],
      faqs: [
        {
          q: 'ग्राफ में लाइन ऊपर-नीचे क्यों होती रहती है?',
          a: 'गूगल मैप्स पर जब कंपटीटर्स को नए रिव्यू मिलते हैं या गूगल अपने लोकल एल्गोरिदम को अपडेट करता है, तो रैंक में उतार-चढ़ाव स्वाभाविक है।',
        },
        {
          q: 'अच्छा विजिबिलिटी (SoLV) स्कोर क्या माना जाता है?',
          a: '50% से ऊपर अच्छा स्कोर है; 75% से ऊपर का मतलब है कि आपके इलाके का लगभग हर ग्राहक आपकी दुकान को सबसे पहले देख रहा है।',
        },
      ],
    },
  },
  {
    id: 'reading-geogrid-map',
    category: 'maps',
    icon: <Layers className="w-5 h-5 text-indigo-600" />,
    en: {
      title: 'Reading Your Geo-Grid Ranking Map',
      subtitle: 'Color Tiers, Radius Spheres & Regional Visibility Analysis',
      summary: 'The interactive map places geographic coordinate pins across your selected service radius (3 km, 5 km, 10 km) to simulate real customers searching from different street corners.',
      exampleScenario: {
        businessName: 'City Center Storefront',
        keyword: 'local retail / service search',
        description: 'A 5 km radius map places 31 pins across city neighborhoods. Pins directly over your neighborhood glow Green (#1–3), while pins 4 km away across the river or highway show Red (#12–20), highlighting geographic areas where optimization is needed.',
      },
      coreConcepts: [
        {
          badge: 'Green Pins (1–3)',
          badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          title: 'Google Local 3-Pack (Prime Spots)',
          description: 'Customers at these coordinates see your business on the main Google search result page without clicking "View all". This drives over 70% of phone calls.',
        },
        {
          badge: 'Amber Pins (4–10)',
          badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
          title: 'First-Page Contenders',
          description: 'Ranked on page 1 of Google Maps. These are high-opportunity zones where minor citation improvements can push you directly into the top 3.',
        },
        {
          badge: 'Red Pins (11–20)',
          badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
          title: 'Second-Page Rankings',
          description: 'Rankings between #11 and #20. Customers rarely scroll this far. These areas require targeted local reviews and photo updates.',
        },
        {
          badge: 'Dark Pins (20+)',
          badgeCls: 'bg-slate-100 text-slate-700 border-slate-300',
          title: 'Outside Top 20',
          description: 'At these coordinates, your business does not rank in the first 20 results. Competitors closer to these pins completely dominate search results.',
        },
      ],
      faqs: [
        {
          q: 'What does the large blue boundary circle represent?',
          a: 'It outlines your scanned service radius (e.g. 5 km radius / 10 km diameter). Every pin inside is probed for rankings.',
        },
        {
          q: 'What are Grey Pins?',
          a: 'Grey pins represent coordinates that were skipped, deduplicated, or had technical timeouts. They are never falsely represented as rank 20+.',
        },
      ],
    },
    hi: {
      title: 'जियोग्रिड रैंकिंग मैप को कैसे पढ़ें',
      subtitle: 'पिन के रंग, 5 किमी दायरा और इलाके की विजिबिलिटी का विश्लेषण',
      summary: 'इंटरएक्टिव मैप आपके चुने हुए दायरे (3 किमी, 5 किमी) में अलग-अलग जगहों पर पिन लगाकर यह दिखाता है कि वहां खड़ा ग्राहक सर्च करने पर आपकी दुकान को किस नंबर पर देखेगा।',
      exampleScenario: {
        businessName: 'उदाहरण: शहर की कोई भी मुख्य दुकान',
        keyword: 'लोकल सर्विस सर्च',
        description: '5 किमी के दायरे में 31 पिन लगाए जाते हैं। आपकी दुकान के पास वाले पिन हरे (#1–3) दिखते हैं, जबकि 4 किमी दूर वाले पिन लाल (#12–20) दिखते हैं, जिससे पता चलता है कि आपको किन इलाकों में अपनी पकड़ मजबूत करनी है।',
      },
      coreConcepts: [
        {
          badge: 'हरे पिन (1–3)',
          badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          title: 'गूगल लोकल 3-पैक (सबसे अहम जगह)',
          description: 'इन जगहों पर खड़ा ग्राहक आपकी दुकान को गूगल के मुख्य पेज पर बिना स्क्रॉल किए देखता है। 70% से ज्यादा कॉल्स यहीं से आती हैं।',
        },
        {
          badge: 'पीले पिन (4–10)',
          badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
          title: 'पहले पेज के दावेदार',
          description: 'गूगल मैप्स के पहले पेज पर मौजूद। थोड़ी सी मेहनत से इन पिनों को आसानी से टॉप 3 (हरे) में लाया जा सकता है।',
        },
        {
          badge: 'लाल पिन (11–20)',
          badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
          title: 'दूसरे पेज की रैंकिंग',
          description: 'रैंक 11 से 20 के बीच। यहां तक बहुत कम ग्राहक पहुंचते हैं। इन इलाकों के लिए खास एसईओ की जरूरत होती है।',
        },
        {
          badge: 'डार्क पिन (20+)',
          badgeCls: 'bg-slate-100 text-slate-700 border-slate-300',
          title: 'टॉप 20 से बाहर',
          description: 'इन जगहों पर आपकी दुकान टॉप 20 में नहीं आ रही है। यहां के स्थानीय दुकानदार सर्च रिजल्ट्स पर हावी हैं।',
        },
      ],
      faqs: [
        {
          q: 'मैप पर बना नीला गोल घेरा क्या दर्शाता है?',
          a: 'यह आपके स्कैन के दायरे (जैसे 5 किमी रेडियस) को दिखाता है। इस घेरे के अंदर मौजूद सभी पिनों की लाइव जांच की जाती है।',
        },
        {
          q: 'ग्रे पिन का क्या मतलब होता है?',
          a: 'ग्रे पिन उन जगहों को दिखाते हैं जहां टाइमआउट या डुप्लीकेट होने के कारण डेटा नहीं मिला। इन्हें कभी गलत तरीके से 20+ नहीं दिखाया जाता।',
        },
      ],
    },
  },
  {
    id: 'keywords-engine',
    category: 'keywords',
    icon: <Sparkles className="w-5 h-5 text-amber-500" />,
    en: {
      title: 'How Target Keywords Are Discovered & Chosen',
      subtitle: 'Google Autocomplete Probing, Intent Validation & Zero Hallucinations',
      summary: 'Rankora does not invent synthetic keywords. It probes Google Autocomplete and local map packs directly to ensure suggested keywords have real search volume and actual local intent.',
      coreConcepts: [
        {
          badge: 'Locality Hierarchy',
          badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
          title: 'Hyper-Local Context',
          description: 'Automatically detects your sublocality, neighborhood, and city to craft authentic geographic search phrases.',
        },
        {
          badge: 'Google Autocomplete API',
          badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          title: 'Live Search Demand Signals',
          description: 'Probes what real customers are actively typing into Google search right now, prioritizing terms with high buyer intent.',
        },
        {
          badge: 'Competitor Category Validation',
          badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
          title: 'Zero Waste Keywords',
          description: 'Ensures top-ranking competitors in your specific category actually trigger a Local Pack for that term before recommending it.',
        },
      ],
      faqs: [
        {
          q: 'Can I add my own custom keywords?',
          a: 'Yes, click "Add Keyword" on any profile or rank tracking screen and enter any custom terms your customers search for.',
        },
      ],
    },
    hi: {
      title: 'कीवर्ड्स कैसे चुने और खोजे जाते हैं',
      subtitle: 'गूगल ऑटो-कम्प्लीट, असली सर्च डिमांड और सटीक कीवर्ड इंजन',
      summary: 'रैंकोरा कोई मनगढ़ंत या नकली कीवर्ड्स नहीं बनाता। यह सीधे गूगल सर्च से यह पता लगाता है कि असली ग्राहक क्या टाइप कर रहे हैं, ताकि आपको केवल काम के कीवर्ड्स मिलें।',
      coreConcepts: [
        {
          badge: 'लोकल मोहल्ला और शहर',
          badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
          title: 'हाइपर-लोकल पहचान',
          description: 'आपकी दुकान के मोहल्ले और शहर के नाम को जोड़कर सटीक लोकल कीवर्ड बनाता है।',
        },
        {
          badge: 'गूगल ऑटो-कम्प्लीट API',
          badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          title: 'असली सर्च डिमांड की जांच',
          description: 'ग्राहक गूगल पर असल में क्या लिखकर खोज रहे हैं, इसकी लाइव जांच करता है जिससे फोन कॉल्स देने वाले कीवर्ड्स सामने आएं।',
        },
        {
          badge: 'कंपटीटर कैटेगरी मिलान',
          badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
          title: 'बेकार कीवर्ड्स से बचाव',
          description: 'यह सुनिश्चित करता है कि आपके कंपटीटर्स भी उन्हीं कीवर्ड्स पर मैप में दिख रहे हैं, तभी वह कीवर्ड आपको सुझाया जाता है।',
        },
      ],
      faqs: [
        {
          q: 'क्या मैं अपने मनचाहे कीवर्ड्स खुद जोड़ सकता हूँ?',
          a: 'हाँ, किसी भी स्क्रीन पर "Add Keyword" बटन दबाकर आप अपने पसंदीदा कीवर्ड्स सीधे टाइप करके जोड़ सकते हैं।',
        },
      ],
    },
  },
  {
    id: 'credits-and-scans',
    category: 'credits',
    icon: <Coins className="w-5 h-5 text-amber-600" />,
    en: {
      title: 'How Scans Use Workspace Credits & Automatic Refunds',
      subtitle: '100% Transparent Consumption, Deduplication & Failed Probe Guarantees',
      summary: 'Every coordinate measured consumes credits strictly based on pin count. If a probe fails, your credits are refunded immediately.',
      coreConcepts: [
        {
          badge: '1 Pin = 1 Credit',
          badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          title: 'Simple Direct Pricing',
          description: 'A 31-pin regional scan consumes 31 credits. A standard 3x3 grid consumes 9 credits.',
        },
        {
          badge: '24-Hour Geo-Cache (0 Credits)',
          badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
          title: 'Free Cached Pins',
          description: 'If another scan already probed a coordinate within the last 24 hours, the cached snapshot is used at 0 credit cost.',
        },
        {
          badge: 'Automatic Safety Refunds',
          badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
          title: 'Failed Probe Protection',
          description: 'If an upstream network timeout occurs on any pin or scan, the required credits are credited back to your balance automatically.',
        },
      ],
      faqs: [
        {
          q: 'Do my unused credits expire?',
          a: 'Credits stay active through your entire billing period or 14-day trial window and roll over with active plans.',
        },
      ],
    },
    hi: {
      title: 'स्कैन में क्रेडिट कैसे खर्च होते हैं और ऑटो-रिफंड के नियम',
      subtitle: '100% पारदर्शी क्रेडिट सिस्टम, कैश्ड पिन फ्री और फेल होने पर तुरंत वापसी',
      summary: 'हर जांचे गए पिन के लिए सीधे क्रेडिट कटते हैं। अगर किसी तकनीकी वजह से कोई पिन या स्कैन फेल होता है, तो आपके क्रेडिट तुरंत वापस कर दिए जाते हैं।',
      coreConcepts: [
        {
          badge: '1 पिन = 1 क्रेडिट',
          badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          title: 'सीधा और आसान हिसाब',
          description: '31-पिन वाले रीजनल स्कैन में 31 क्रेडिट और 3x3 ग्रिड में 9 क्रेडिट लगते हैं।',
        },
        {
          badge: '24 घंटे का कैशे (0 क्रेडिट)',
          badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
          title: 'पहले से जांची जगहें फ्री',
          description: 'अगर उस जगह को पिछले 24 घंटे में किसी स्कैन ने पहले ही जांचा है, तो उसका डेटा बिना कोई क्रेडिट काटे फ्री मिलता है।',
        },
        {
          badge: 'ऑटोमैटिक रिफंड गारंटी',
          badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
          title: 'फेल होने पर पैसे की सुरक्षा',
          description: 'अगर कोई पिन टाइमआउट या एरर देता है, तो उसका क्रेडिट तुरंत आपके अकाउंट बैलेंस में वापस जोड़ दिया जाता है।',
        },
      ],
      faqs: [
        {
          q: 'क्या मेरे बचे हुए क्रेडिट कभी एक्सपायर होते हैं?',
          a: 'आपके क्रेडिट आपके बिलिंग चक्र और 14-दिवसीय ट्रायल के दौरान सुरक्षित रहते हैं और एक्टिव प्लान में आगे जुड़ते रहते हैं।',
        },
      ],
    },
  },
];

export const HelpPage: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  const categories = useMemo(() => [
    { key: 'all', labelEn: 'All Guides', labelHi: 'सभी गाइड्स' },
    { key: 'rankings', labelEn: 'Rankings & Distance', labelHi: 'रैंकिंग और दूरी' },
    { key: 'graphs', labelEn: 'Sparklines & Graphs', labelHi: 'ग्राफ और ट्रेंड' },
    { key: 'maps', labelEn: 'Reading GeoGrid Maps', labelHi: 'जियोग्रिड मैप' },
    { key: 'keywords', labelEn: 'Keyword Engine', labelHi: 'कीवर्ड्स' },
    { key: 'credits', labelEn: 'Credits & Scans', labelHi: 'क्रेडिट और बिलिंग' },
  ], []);

  const filteredGuides = useMemo(() => {
    return GUIDES_DATA.filter((guide) => {
      const matchesCategory = selectedCategory === 'all' || guide.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const localized = guide[lang];
      return (
        localized.title.toLowerCase().includes(q) ||
        localized.subtitle.toLowerCase().includes(q) ||
        localized.summary.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery, lang]);

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-7 flex flex-col min-w-0">
        <div className="max-w-6xl mx-auto w-full space-y-6">

          {/* Top Hero Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
            <div className="relative z-10 space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{lang === 'en' ? 'Universal Platform Guide & Help Center' : 'हेल्प और नॉलेज सेंटर'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {lang === 'en'
                  ? 'How GeoGrid Rank Tracking Works for Any Business'
                  : 'जियोग्रिड रैंक ट्रैकिंग किसी भी बिजनेस के लिए कैसे काम करती है'}
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                {lang === 'en'
                  ? 'Whether you run a clinic, cafe, retail shop, salon, or service company — learn how Google’s distance algorithm ranks your business across street corners.'
                  : 'चाहे आपका कोई क्लिनिक हो, कैफे, दुकान, सैलून या सर्विस कंपनी — जानें कि गूगल का दूरी एल्गोरिदम मैप पर आपकी दुकान को कैसे रैंक करता है।'}
              </p>
            </div>

            {/* Language Switcher in Hero */}
            <div className="sm:absolute sm:top-6 sm:right-6 mt-4 sm:mt-0 z-20">
              <div className="inline-flex items-center p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-md">
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    lang === 'en'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLang('hi')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    lang === 'hi'
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>हिंदी</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {categories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSelectedCategory(c.key as Category)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedCategory === c.key
                      ? 'bg-[#006EEE] text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {lang === 'en' ? c.labelEn : c.labelHi}
                </button>
              ))}
            </div>

            {/* Quick Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'en' ? 'Search topics...' : 'विषय खोजें...'}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006EEE] transition"
              />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="space-y-6">
            {filteredGuides.map((guide) => {
              const content = guide[lang];
              return (
                <Card
                  key={guide.id}
                  className="p-5 sm:p-7 bg-white border-slate-200 shadow-xs rounded-2xl space-y-5 hover:border-slate-300 transition"
                >
                  {/* Card Header */}
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 shrink-0 mt-0.5">
                      {guide.icon}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                          {content.title}
                        </h2>
                      </div>
                      <p className="text-xs font-semibold text-[#006EEE]">
                        {content.subtitle}
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed pt-1">
                        {content.summary}
                      </p>
                    </div>
                  </div>

                  {/* Generic Example Callout Card (When Available) */}
                  {content.exampleScenario && (
                    <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/70 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                        <Lightbulb className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                          {lang === 'en' ? 'Universal Example Scenario:' : 'आसान उदाहरण (Example):'}
                        </span>
                        <span className="font-semibold text-blue-800">
                          {content.exampleScenario.businessName}
                        </span>
                      </div>
                      <p className="text-xs text-blue-950/80 leading-relaxed pl-6">
                        {content.exampleScenario.description}
                      </p>
                    </div>
                  )}

                  {/* Core Concepts Visual Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {content.coreConcepts.map((c, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1.5 hover:bg-slate-50 transition"
                      >
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.badgeCls}`}>
                          {c.badge}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900">{c.title}</h3>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{c.description}</p>
                      </div>
                    ))}
                  </div>

                  {/* Quick FAQ Expandables */}
                  {content.faqs && content.faqs.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {lang === 'en' ? 'Frequently Asked Questions' : 'अक्सर पूछे जाने वाले सवाल'}
                      </h4>
                      <div className="space-y-2">
                        {content.faqs.map((faq, idx) => {
                          const faqKey = `${guide.id}-${idx}`;
                          const isExpanded = expandedFaqId === faqKey;
                          return (
                            <div
                              key={idx}
                              className="rounded-xl border border-slate-200/80 bg-slate-50/40 overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => setExpandedFaqId(isExpanded ? null : faqKey)}
                                className="w-full flex items-center justify-between p-3 text-left text-xs font-bold text-slate-800 hover:text-[#006EEE] transition cursor-pointer"
                              >
                                <span>{faq.q}</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                )}
                              </button>
                              {isExpanded && (
                                <div className="px-3 pb-3 text-xs text-slate-600 leading-relaxed border-t border-slate-200/60 pt-2 bg-white">
                                  {faq.a}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}

            {filteredGuides.length === 0 && (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">
                  {lang === 'en' ? 'No matching topics found' : 'कोई विषय नहीं मिला'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'en' ? 'Try adjusting your search query or select All Guides.' : 'सर्च बदलें या "सभी गाइड्स" चुनें।'}
                </p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default HelpPage;
