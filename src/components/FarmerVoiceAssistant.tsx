"use client";

import { useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

export type VoiceFarmerData = {
  product?: string;
  category?: string;
  quantity?: string;
  unit?: string;
  farmName?: string;
  location?: string;
  harvestDate?: string;
  certification?: string;
  farmerName?: string;
};

type Props = {
  onFillForm: (data: VoiceFarmerData) => void;
};

type SpeechRecognitionEventLike = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
    length: number;
  };
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// ======================================================
// KNOWN PRODUCTS
//
// These products get automatic categories.
//
// IMPORTANT:
// Unknown products are ALSO supported.
// They will be extracted from speech and category = "Other".
// ======================================================

const productDictionary = [
  // ---------------- VEGETABLES ----------------

  {
    words: ["టమాటా", "టమాటాలు", "టమాట", "tomato", "tomatoes"],
    product: "Organic Tomatoes",
    category: "Vegetables",
  },
  {
    words: ["క్యారెట్", "క్యారెట్లు", "carrot", "carrots"],
    product: "Organic Carrots",
    category: "Vegetables",
  },
  {
    words: ["బంగాళాదుంప", "బంగాళాదుంపలు", "potato", "potatoes"],
    product: "Organic Potatoes",
    category: "Vegetables",
  },
  {
    words: ["ఉల్లిపాయ", "ఉల్లిపాయలు", "onion", "onions"],
    product: "Organic Onions",
    category: "Vegetables",
  },
  {
    words: ["మిరప", "మిరపకాయ", "మిరపకాయలు", "chilli", "chillies"],
    product: "Organic Chillies",
    category: "Vegetables",
  },
  {
    words: ["వంకాయ", "వంకాయలు", "brinjal", "eggplant"],
    product: "Organic Brinjal",
    category: "Vegetables",
  },
  {
    words: ["బెండకాయ", "బెండకాయలు", "okra", "lady finger"],
    product: "Organic Okra",
    category: "Vegetables",
  },
  {
    words: ["క్యాబేజీ", "cabbage"],
    product: "Organic Cabbage",
    category: "Vegetables",
  },
  {
    words: ["కాలీఫ్లవర్", "cauliflower"],
    product: "Organic Cauliflower",
    category: "Vegetables",
  },
  {
    words: ["దోసకాయ", "కీరదోస", "cucumber"],
    product: "Organic Cucumber",
    category: "Vegetables",
  },
  {
    words: ["బీట్‌రూట్", "బీట్రూట్", "beetroot"],
    product: "Organic Beetroot",
    category: "Vegetables",
  },
  {
    words: ["ముల్లంగి", "radish"],
    product: "Organic Radish",
    category: "Vegetables",
  },
  {
    words: ["పాలకూర", "spinach"],
    product: "Organic Spinach",
    category: "Vegetables",
  },

  // ---------------- FRUITS ----------------

  {
    words: ["మామిడి", "మామిడిపండ్లు", "mango", "mangoes"],
    product: "Organic Mangoes",
    category: "Fruits",
  },
  {
    words: ["అరటి", "అరటిపండ్లు", "banana", "bananas"],
    product: "Organic Bananas",
    category: "Fruits",
  },
  {
    words: ["జామ", "జామపండు", "guava", "guavas"],
    product: "Organic Guavas",
    category: "Fruits",
  },
  {
    words: ["బొప్పాయి", "papaya", "papayas"],
    product: "Organic Papayas",
    category: "Fruits",
  },
  {
    words: ["నారింజ", "orange", "oranges"],
    product: "Organic Oranges",
    category: "Fruits",
  },
  {
    words: ["ద్రాక్ష", "grapes"],
    product: "Organic Grapes",
    category: "Fruits",
  },
  {
    words: ["పుచ్చకాయ", "watermelon"],
    product: "Organic Watermelon",
    category: "Fruits",
  },
  {
    words: ["దానిమ్మ", "pomegranate"],
    product: "Organic Pomegranate",
    category: "Fruits",
  },

  // ---------------- GRAINS ----------------

  {
    words: ["బియ్యం", "వరి", "rice", "paddy"],
    product: "Organic Rice",
    category: "Grains",
  },
  {
    words: ["గోధుమ", "గోధుమలు", "wheat"],
    product: "Organic Wheat",
    category: "Grains",
  },
  {
    words: ["మొక్కజొన్న", "corn", "maize"],
    product: "Organic Maize",
    category: "Grains",
  },
  {
    words: ["జొన్న", "జొన్నలు", "jowar", "sorghum"],
    product: "Organic Jowar",
    category: "Grains",
  },
  {
    words: ["సజ్జ", "సజ్జలు", "bajra", "pearl millet"],
    product: "Organic Bajra",
    category: "Grains",
  },
  {
    words: ["రాగి", "finger millet"],
    product: "Organic Ragi",
    category: "Grains",
  },

  // ---------------- PULSES ----------------

  {
    words: ["కందిపప్పు", "కంది", "toor dal", "pigeon pea"],
    product: "Organic Toor Dal",
    category: "Pulses",
  },
  {
    words: ["పెసరపప్పు", "పెసలు", "moong dal", "green gram"],
    product: "Organic Green Gram",
    category: "Pulses",
  },
  {
    words: ["మినపప్పు", "మినుములు", "urad dal", "black gram"],
    product: "Organic Black Gram",
    category: "Pulses",
  },
  {
    words: ["శనగ", "శనగలు", "chickpea", "chickpeas"],
    product: "Organic Chickpeas",
    category: "Pulses",
  },

  // ---------------- SPICES ----------------

  {
    words: ["పసుపు", "turmeric"],
    product: "Organic Turmeric",
    category: "Spices",
  },
  {
    words: ["ధనియాలు", "ధనియా", "coriander"],
    product: "Organic Coriander",
    category: "Spices",
  },
  {
    words: ["జీలకర్ర", "cumin"],
    product: "Organic Cumin",
    category: "Spices",
  },
  {
    words: ["అల్లం", "ginger"],
    product: "Organic Ginger",
    category: "Spices",
  },
  {
    words: ["వెల్లుల్లి", "garlic"],
    product: "Organic Garlic",
    category: "Spices",
  },

  // ---------------- DAIRY ----------------

  {
    words: ["పాలు", "milk"],
    product: "Organic Milk",
    category: "Dairy",
  },
];

// ======================================================
// HELPER - CLEAN UNKNOWN PRODUCT
// ======================================================

function cleanProductName(value: string): string {
  return value
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ======================================================
// HELPER - VALID DATE
// ======================================================

function makeValidDate(
  dayText: string,
  monthText: string,
  yearText: string,
): string | undefined {
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  if (!day || !month || !year) {
    return undefined;
  }

  if (year < 2000 || year > 2100) {
    return undefined;
  }

  const candidate = new Date(year, month - 1, day);

  const valid =
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day;

  if (!valid) {
    return undefined;
  }

  const paddedDay = String(day).padStart(2, "0");
  const paddedMonth = String(month).padStart(2, "0");

  return `${year}-${paddedMonth}-${paddedDay}`;
}

// ======================================================
// PARSER
// ======================================================

function parseVoiceTranscript(transcript: string): VoiceFarmerData {
  const text = transcript.trim();
  const lowerText = text.toLowerCase();

  const data: VoiceFarmerData = {};

  // ====================================================
  // 1. PRODUCT + CATEGORY
  // ====================================================

  for (const item of productDictionary) {
    const found = item.words.some((word) =>
      lowerText.includes(word.toLowerCase()),
    );

    if (found) {
      data.product = item.product;
      data.category = item.category;
      break;
    }
  }

  // ====================================================
  // 2. UNKNOWN / ANY PRODUCT FALLBACK
  //
  // This allows products that are NOT in our dictionary.
  //
  // Examples:
  //
  // నేను క్యారెట్ పండించాను
  // నేను బ్రోకలీ పండించాను
  // నేను స్ట్రాబెర్రీ పండించాను
  // నేను కొత్త పంట పండించాను
  //
  // If product isn't known:
  // product = spoken product
  // category = Other
  // ====================================================

  if (!data.product) {
    const teluguProductMatch = text.match(
      /(?:నేను\s+)?(.+?)\s+(?:పండించాను|పండించాను|సాగు\s+చేశాను|సాగు\s+చేసాను)(?=\s|$)/i,
    );

    if (teluguProductMatch) {
      const spokenProduct = cleanProductName(teluguProductMatch[1]);

      if (spokenProduct) {
        data.product = spokenProduct;
        data.category = "Other";
      }
    }
  }

  // English fallback:
  //
  // I grew broccoli
  // I harvested broccoli
  // I cultivated broccoli

  if (!data.product) {
    const englishProductMatch = text.match(
      /(?:i\s+)?(?:grew|grow|harvested|cultivated)\s+(.+?)(?=\s+(?:quantity|farm|location|harvest\s+date|my\s+name)|$)/i,
    );

    if (englishProductMatch) {
      const spokenProduct = cleanProductName(englishProductMatch[1]);

      if (spokenProduct) {
        data.product = spokenProduct;
        data.category = "Other";
      }
    }
  }

  // ====================================================
  // 3. QUANTITY + UNIT
  // ====================================================

  const quantityMatch = text.match(
    /(?:పరిమాణం\s*)?(\d+(?:\.\d+)?)\s*(కిలోలు|కిలో|కేజీలు|కేజీ|కేజిలు|kg|kgs|గ్రాములు|గ్రాము|గ్రామ్|g|టన్నులు|టన్ను|tonnes?|లీటర్లు|లీటర్|litres?|liters?|యూనిట్లు|units?|బాక్సులు|బాక్సులు|boxes?)/i,
  );

  if (quantityMatch) {
    data.quantity = quantityMatch[1];

    const spokenUnit = quantityMatch[2].toLowerCase();

    if (
      spokenUnit.includes("కిలో") ||
      spokenUnit.includes("కేజీ") ||
      spokenUnit.includes("కేజి") ||
      spokenUnit === "kg" ||
      spokenUnit === "kgs"
    ) {
      data.unit = "kg";
    } else if (
      spokenUnit.includes("గ్రామ్") ||
      spokenUnit.includes("గ్రాము") ||
      spokenUnit === "g"
    ) {
      data.unit = "g";
    } else if (spokenUnit.includes("టన్ను") || spokenUnit.startsWith("tonne")) {
      data.unit = "tonnes";
    } else if (
      spokenUnit.includes("లీట") ||
      spokenUnit.startsWith("litre") ||
      spokenUnit.startsWith("liter")
    ) {
      data.unit = "litres";
    } else if (spokenUnit.includes("యూనిట్") || spokenUnit.startsWith("unit")) {
      data.unit = "units";
    } else if (
      spokenUnit.includes("బాక్స్") ||
      spokenUnit.includes("బాక్సు") ||
      spokenUnit.startsWith("box")
    ) {
      data.unit = "boxes";
    }
  }

  // ====================================================
  // 4. FARM NAME
  //
  // Example:
  // నా పొలం పేరు గ్రీన్ పార్క్
  // ====================================================

  const farmNameMatch = text.match(
    /(?:నా\s*)?పొలం\s*పేరు\s+(.+?)(?=\s+(?:నా\s+పేరు|రైతు\s+పేరు|ప్రదేశం|నా\s+ప్రదేశం|లొకేషన్|నా\s+లొకేషన్|లోకేషన్|నా\s+లోకేషన్|స్థలం|నా\s+స్థలం|హార్వెస్ట్|పంట\s+తేదీ|సర్టిఫికేట్|సర్టిఫికేషన్)|$)/i,
  );

  if (farmNameMatch) {
    data.farmName = farmNameMatch[1].trim();
  }

  // English fallback

  if (!data.farmName) {
    const englishFarmMatch = text.match(
      /farm\s+name\s+(?:is\s+)?(.+?)(?=\s+(?:my\s+name|farmer\s+name|location|harvest|certificate|certification)|$)/i,
    );

    if (englishFarmMatch) {
      data.farmName = englishFarmMatch[1].trim();
    }
  }

  // ====================================================
  // 5. LOCATION
  //
  // Examples:
  //
  // ప్రదేశం తెలంగాణ
  // నా ప్రదేశం తెలంగాణ
  // లొకేషన్ తెలంగాణ
  // నా లొకేషన్ తెలంగాణ
  // లోకేషన్ తెలంగాణ
  // నా పొలం లొకేషన్ తెలంగాణ
  // ====================================================

  const locationMatch = text.match(
    /(?:(?:నా\s+)?(?:పొలం\s+)?)?(?:ప్రదేశం|లొకేషన్|లోకేషన్|స్థలం)\s+(.+?)(?=\s+(?:నా\s+పేరు|రైతు\s+పేరు|నా\s+పొలం\s+పేరు|పొలం\s+పేరు|హార్వెస్ట్|పంట\s+తేదీ|సర్టిఫికేట్|సర్టిఫికేషన్)|$)/i,
  );

  if (locationMatch) {
    data.location = locationMatch[1].trim();
  }

  // English fallback

  if (!data.location) {
    const englishLocationMatch = text.match(
      /location\s+(?:is\s+)?(.+?)(?=\s+(?:my\s+name|farmer\s+name|farm\s+name|harvest|certificate|certification)|$)/i,
    );

    if (englishLocationMatch) {
      data.location = englishLocationMatch[1].trim();
    }
  }

  // ====================================================
  // 6. HARVEST DATE
  //
  // Examples:
  //
  // పంట తేదీ 18 10 2026
  // పంట తేదీ 18/10/2026
  // పంట తేదీ 18-10-2026
  //
  // హార్వెస్ట్ డేట్ 18 10 2026
  // హార్వెస్ట్ తేదీ 18 10 2026
  //
  // harvest date 18 10 2026
  // ====================================================

  const harvestDateMatch = text.match(
    /(?:పంట\s+తేదీ|హార్వెస్ట్\s+డేట్|హార్వెస్ట్\s+తేదీ|harvest\s+date)\s*(?:is\s+)?(\d{1,2})[\s./-]+(\d{1,2})[\s./-]+(\d{4})/i,
  );

  if (harvestDateMatch) {
    const parsedDate = makeValidDate(
      harvestDateMatch[1],
      harvestDateMatch[2],
      harvestDateMatch[3],
    );

    if (parsedDate) {
      data.harvestDate = parsedDate;
    }
  }

  // ====================================================
  // 7. FARMER NAME
  //
  // Examples:
  //
  // నా పేరు జోష్ణ
  // రైతు పేరు రమేష్
  // ====================================================

  const farmerNameMatch = text.match(
    /(?:నా\s+పేరు|రైతు\s+పేరు)\s+(.+?)(?=\s+(?:ప్రదేశం|నా\s+ప్రదేశం|లొకేషన్|నా\s+లొకేషన్|లోకేషన్|నా\s+లోకేషన్|స్థలం|నా\s+స్థలం|నా\s+పొలం|పొలం\s+పేరు|హార్వెస్ట్|పంట\s+తేదీ|సర్టిఫికేట్|సర్టిఫికేషన్)|$)/i,
  );

  if (farmerNameMatch) {
    data.farmerName = farmerNameMatch[1].trim();
  }

  // English fallback

  if (!data.farmerName) {
    const englishNameMatch = text.match(
      /(?:my\s+name\s+is|farmer\s+name\s+(?:is\s+)?)\s*(.+?)(?=\s+(?:location|farm\s+name|harvest|certificate|certification)|$)/i,
    );

    if (englishNameMatch) {
      data.farmerName = englishNameMatch[1].trim();
    }
  }

  // ====================================================
  // 8. CERTIFICATION
  // ====================================================

  const certificationMatch = text.match(
    /(?:సర్టిఫికేట్|సర్టిఫికేషన్)\s+(?:నంబర్\s+|నెంబర్\s+)?([A-Za-z0-9-]+)/i,
  );

  if (certificationMatch) {
    data.certification = certificationMatch[1].trim();
  }

  // English fallback

  if (!data.certification) {
    const englishCertificationMatch = text.match(
      /(?:certificate|certification)\s+(?:number\s+|reference\s+|id\s+)?([A-Za-z0-9-]+)/i,
    );

    if (englishCertificationMatch) {
      data.certification = englishCertificationMatch[1].trim();
    }
  }

  return data;
}

// ======================================================
// COMPONENT
// ======================================================

export default function FarmerVoiceAssistant({ onFillForm }: Props) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Latest recognized speech.
  const transcriptRef = useRef("");

  // True when Stop & fill form was clicked.
  const shouldFillRef = useRef(false);

  // Prevent duplicate form filling.
  const alreadyFilledRef = useRef(false);

  // ====================================================
  // EXTRACT + FILL FORM
  // ====================================================

  function extractAndFill(spokenText: string) {
    const cleanText = spokenText.trim();

    if (!cleanText) {
      setMessage("No speech was captured. Please try again.");
      return;
    }

    const extracted = parseVoiceTranscript(cleanText);

    console.log("VOICE TRANSCRIPT:", cleanText);
    console.log("VOICE EXTRACTED DATA:", extracted);

    if (Object.keys(extracted).length === 0) {
      setMessage(
        "Speech was recognized, but no farmer details could be identified. Please try again.",
      );

      return;
    }

    onFillForm(extracted);

    setMessage(
      "Details extracted. Please review the farmer form and complete any missing fields before registering.",
    );
  }

  // ====================================================
  // START LISTENING
  // ====================================================

  function startListening() {
    setMessage("");
    setTranscript("");

    transcriptRef.current = "";
    shouldFillRef.current = false;
    alreadyFilledRef.current = false;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        "Speech recognition is not supported in this browser. Please use Google Chrome.",
      );

      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "te-IN";
    recognition.continuous = true;
    recognition.interimResults = false;

    // ==================================================
    // SPEECH RESULT
    // ==================================================

    recognition.onresult = (event) => {
      let spokenText = "";

      for (let i = 0; i < event.results.length; i++) {
        spokenText += `${event.results[i][0].transcript} `;
      }

      const cleanTranscript = spokenText.trim();

      console.log("VOICE RESULT:", cleanTranscript);

      // Save immediately.
      transcriptRef.current = cleanTranscript;

      // Show on screen.
      setTranscript(cleanTranscript);

      // Chrome can return final text after Stop was clicked.
      if (
        shouldFillRef.current &&
        cleanTranscript &&
        !alreadyFilledRef.current
      ) {
        alreadyFilledRef.current = true;

        extractAndFill(cleanTranscript);
      }
    };

    // ==================================================
    // ERROR
    // ==================================================

    recognition.onerror = (event) => {
      console.error("VOICE RECOGNITION ERROR:", event.error);

      shouldFillRef.current = false;

      setMessage(`Voice recognition error: ${event.error}`);

      setListening(false);
    };

    // ==================================================
    // RECOGNITION ENDED
    // ==================================================

    recognition.onend = () => {
      console.log("VOICE RECOGNITION ENDED");
      console.log("FINAL TRANSCRIPT:", transcriptRef.current);

      setListening(false);

      if (!shouldFillRef.current) {
        return;
      }

      const finalTranscript = transcriptRef.current.trim();

      if (!finalTranscript) {
        setMessage("No speech was captured. Please try again.");
        return;
      }

      if (!alreadyFilledRef.current) {
        alreadyFilledRef.current = true;

        extractAndFill(finalTranscript);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();

      setListening(true);

      setMessage("Listening in Telugu...");
    } catch (error) {
      console.error("COULD NOT START VOICE RECOGNITION:", error);

      setMessage("Could not start the microphone.");

      setListening(false);
    }
  }

  // ====================================================
  // STOP LISTENING
  // ====================================================

  function stopListening() {
    shouldFillRef.current = true;

    setMessage("Finishing speech recognition...");

    try {
      recognitionRef.current?.stop();
    } catch (error) {
      console.error("COULD NOT STOP VOICE RECOGNITION:", error);
    }
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <div className="voice-assistant-note">
      <Mic size={17} />

      <span style={{ width: "100%" }}>
        <strong>Voice-to-batch assistant</strong>

        <small>
          Speak naturally in Telugu. GreenTrace will extract the details and
          fill the farmer form for you.
        </small>

        <div
          style={{
            marginTop: "12px",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {!listening ? (
            <button
              type="button"
              className="button button-primary"
              onClick={startListening}
            >
              <Mic size={17} />
              Speak in Telugu
            </button>
          ) : (
            <button type="button" className="button" onClick={stopListening}>
              <MicOff size={17} />
              Stop & fill form
            </button>
          )}
        </div>

        {message && (
          <small
            style={{
              display: "block",
              marginTop: "10px",
            }}
          >
            {message}
          </small>
        )}

        {transcript && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              border: "1px solid #ddd",
              borderRadius: "10px",
            }}
          >
            <small>Recognized Telugu speech</small>

            <p
              lang="te"
              style={{
                marginTop: "6px",
                marginBottom: 0,
              }}
            >
              {transcript}
            </p>
          </div>
        )}
      </span>
    </div>
  );
}
