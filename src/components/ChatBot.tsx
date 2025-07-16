import React, { useEffect, useRef, useState } from "react";

interface Message {
  sender: "user" | "bot";
  text: string;
  id: string;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<string>("");
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const openaiApiKey = process.env.REACT_APP_OPENAI_API_KEY;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check for speech recognition support and permissions
  useEffect(() => {
    const checkSpeechSupport = async () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.log("❌ Speech recognition not supported in this browser.");
        setSpeechSupported(false);
        return;
      }

      setSpeechSupported(true);

      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.log("❌ HTTPS required for microphone access");
        setPermissionStatus("HTTPS required for microphone access");
        return;
      }

      try {
        const permissionResult = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log("🔍 Microphone permission:", permissionResult.state);
        setPermissionStatus(permissionResult.state);
        
        permissionResult.addEventListener('change', () => {
          console.log("🔄 Permission changed:", permissionResult.state);
          setPermissionStatus(permissionResult.state);
        });
      } catch (error) {
        console.log("⚠️ Permission check not supported, will try direct access");
        setPermissionStatus("unknown");
      }
    };

    checkSpeechSupport();
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!speechSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("🎙️ Voice recognition started");
      setIsListening(true);
      setPermissionStatus("listening");
      isStartingRef.current = false;
    };

    recognition.onresult = (event: any) => {
      const result = event.results[event.resultIndex];
      const transcript = result?.[0]?.transcript;
      const confidence = result?.[0]?.confidence;
      
      console.log("📝 Transcript:", transcript, "Confidence:", confidence);
      
      if (isSpeaking) {
        console.log("🔇 Ignoring transcript - AI is speaking");
        return;
      }
      
      if (transcript && transcript.trim().length > 0) {
        console.log("✅ Accepting transcript:", transcript);
        setIsProcessingVoice(true);
        setQuery(transcript.trim());
        setTimeout(() => {
          sendMessage(transcript.trim());
          setIsProcessingVoice(false);
        }, 500);
      }
    };

    recognition.onerror = (e: any) => {
      console.error("❌ Speech error:", e.error);
      setIsListening(false);
      isStartingRef.current = false;
      
      switch (e.error) {
        case 'not-allowed':
          setPermissionStatus("denied");
          setVoiceEnabled(false);
          break;
        case 'no-speech':
          if (voiceEnabled && !isSpeaking) {
            restartRecognition();
          }
          break;
        case 'audio-capture':
          setPermissionStatus("no-microphone");
          setVoiceEnabled(false);
          break;
        default:
          if (voiceEnabled && !isSpeaking) {
            restartRecognition();
          }
      }
    };

    recognition.onend = () => {
      console.log("🔁 Recognition ended");
      setIsListening(false);
      isStartingRef.current = false;
      
      if (voiceEnabled && !isSpeaking) {
        restartRecognition();
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [speechSupported, voiceEnabled, isSpeaking]);

  const restartRecognition = async () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    if (!voiceEnabled || isSpeaking) return;
    
    restartTimeoutRef.current = setTimeout(async () => {
      if (voiceEnabled && !isListening && !isStartingRef.current && !isSpeaking) {
        await startRecognition();
      }
    }, 1000);
  };

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionStatus("granted");
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      setPermissionStatus("denied");
      return false;
    }
  };

  const startRecognition = async () => {
    if (!recognitionRef.current || isSpeaking) return;

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }

    isStartingRef.current = false;
    setIsListening(false);

    try {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      isStartingRef.current = true;
      recognitionRef.current.start();
    } catch (error) {
      console.error("❌ Error starting recognition:", error);
      isStartingRef.current = false;
      setIsListening(false);
      
      if (voiceEnabled && !isSpeaking) {
        setTimeout(() => {
          startRecognition();
        }, 2000);
      }
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    isStartingRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
  };

  const toggleVoiceInput = async () => {
    if (!speechSupported) return;

    const newVoiceEnabled = !voiceEnabled;

    if (newVoiceEnabled) {
      if (permissionStatus === "denied" || permissionStatus === "unknown") {
        const granted = await requestMicrophonePermission();
        if (!granted) return;
      }

      setVoiceEnabled(true);
      if (!isSpeaking) {
        await startRecognition();
      }
    } else {
      setVoiceEnabled(false);
      stopRecognition();
    }
  };

  const sendMessage = async (textOverride?: string) => {
    const input = textOverride || query;
    if (!input.trim()) return;

    const messageId = Date.now().toString();
    const userMessage: Message = { sender: "user", text: input, id: messageId };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setQuery(""); // Clear input immediately

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: input }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      const botMessageId = (Date.now() + 1).toString();
      const formatted = formatResponse(data.response);
      const botMessage: Message = { sender: "bot", text: formatted, id: botMessageId };
      setMessages((prev) => [...prev, botMessage]);

      // Start speaking immediately with original text
      if (!muted) {
        await speakWithOpenAI(data.response, botMessageId);
      }
    } catch (e) {
      console.error("❌ Failed to connect to assistant", e);
      const errorId = (Date.now() + 2).toString();
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "⚠️ Failed to connect to assistant.", id: errorId },
      ]);
    }

    setLoading(false);
  };

  const speakWithOpenAI = async (text: string, messageId: string) => {
    if (!openaiApiKey) return;

    try {
      setIsSpeaking(true);
      setCurrentSpeakingId(messageId);
      stopRecognition();

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1-hd",
          voice: "nova",
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        setIsSpeaking(false);
        setCurrentSpeakingId(null);
        isStartingRef.current = false;
        setIsListening(false);
        
        if (voiceEnabled) {
          setTimeout(() => {
            startRecognition();
          }, 500);
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
        setIsSpeaking(false);
        setCurrentSpeakingId(null);
        isStartingRef.current = false;
        setIsListening(false);
        
        if (voiceEnabled) {
          setTimeout(() => {
            startRecognition();
          }, 500);
        }
      };
      
      await audio.play();
    } catch (err) {
      console.error("❌ TTS failed", err);
      setIsSpeaking(false);
      setCurrentSpeakingId(null);
      isStartingRef.current = false;
      setIsListening(false);
      
      if (voiceEnabled) {
        setTimeout(() => {
          startRecognition();
        }, 500);
      }
    }
  };

  const formatResponse = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/- ([^\n]+)/g, "• $1")
      .replace(/\d+\.\s/g, "<br /><br /><strong>$&</strong>")
      .replace(/(?:\r\n|\r|\n)/g, "<br />");
  };

  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
    setCurrentSpeakingId(null);
    isStartingRef.current = false;
    setIsListening(false);
    
    if (voiceEnabled) {
      setTimeout(() => {
        startRecognition();
      }, 500);
    }
  };

  const styles = {
    container: {
      maxWidth: '900px',
      margin: '20px auto',
      fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      padding: '20px',
      boxSizing: 'border-box' as const,
    },
    card: {
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '20px',
      padding: '30px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.2)',
    },
    header: {
      textAlign: 'center' as const,
      marginBottom: '30px',
      color: '#2c3e50',
      fontSize: '28px',
      fontWeight: '600',
      background: 'linear-gradient(45deg, #667eea, #764ba2)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    statusBar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 20px',
      background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
      borderRadius: '12px',
      marginBottom: '20px',
      fontSize: '12px',
      color: '#6c757d',
      flexWrap: 'wrap' as const,
      gap: '10px',
    },
    statusItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
    },
    chatContainer: {
      border: '2px solid #e9ecef',
      borderRadius: '16px',
      padding: '20px',
      height: '500px',
      overflowY: 'auto' as const,
      background: 'linear-gradient(135deg, #fafbfc, #f8f9fa)',
      marginBottom: '20px',
      scrollBehavior: 'smooth' as const,
    },
    messageContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '15px',
    },
    message: {
      maxWidth: '80%',
      padding: '15px 20px',
      borderRadius: '18px',
      fontSize: '16px',
      lineHeight: '1.5',
      wordWrap: 'break-word' as const,
      position: 'relative' as const,
      animation: 'slideIn 0.3s ease-out',
    },
    userMessage: {
      alignSelf: 'flex-end' as const,
      background: 'linear-gradient(135deg, #667eea, #764ba2)',
      color: 'white',
      borderBottomRightRadius: '6px',
      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
    },
    botMessage: {
      alignSelf: 'flex-start' as const,
      background: 'linear-gradient(135deg, #ffffff, #f8f9fa)',
      color: '#2c3e50',
      borderBottomLeftRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      border: '1px solid rgba(0,0,0,0.05)',
    },
    inputContainer: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      marginBottom: '15px',
    },
    input: {
      flex: 1,
      padding: '16px 20px',
      fontSize: '16px',
      borderRadius: '12px',
      border: '2px solid #e9ecef',
      outline: 'none',
      transition: 'all 0.3s ease',
      background: 'linear-gradient(135deg, #ffffff, #f8f9fa)',
    },
    button: {
      padding: '16px 20px',
      fontSize: '14px',
      fontWeight: '600',
      border: 'none',
      borderRadius: '12px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    },
    voiceStatus: {
      textAlign: 'center' as const,
      padding: '15px 20px',
      borderRadius: '12px',
      fontSize: '16px',
      fontWeight: '500',
      marginTop: '15px',
      transition: 'all 0.3s ease',
    },
    loadingIndicator: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontStyle: 'italic',
      color: '#6c757d',
      padding: '10px 20px',
      background: 'rgba(108, 117, 125, 0.1)',
      borderRadius: '18px',
      alignSelf: 'flex-start' as const,
    },
    spinner: {
      width: '20px',
      height: '20px',
      border: '2px solid #e9ecef',
      borderTop: '2px solid #6c757d',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.header}>🎤 PDF Voice Chat Assistant</h1>

        <div style={styles.statusBar}>
          <div style={styles.statusItem}>
            <span>Speech:</span>
            <span>{speechSupported ? "✅" : "❌"}</span>
          </div>
          <div style={styles.statusItem}>
            <span>Permission:</span>
            <span>{permissionStatus}</span>
          </div>
          <div style={styles.statusItem}>
            <span>HTTPS:</span>
            <span>{location.protocol === 'https:' || location.hostname === 'localhost' ? "✅" : "❌"}</span>
          </div>
          <div style={styles.statusItem}>
            <span>AI Speaking:</span>
            <span>{isSpeaking ? "" : "Yes"}</span>
          </div>
        </div>

        <div style={styles.chatContainer} ref={chatContainerRef}>
          <div style={styles.messageContainer}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.message,
                  ...(msg.sender === "user" ? styles.userMessage : styles.botMessage),
                }}
                dangerouslySetInnerHTML={{
                  __html: msg.text
                }}
              />
            ))}
            {loading && (
              <div style={styles.loadingIndicator}>
                <div style={styles.spinner}></div>
                <span>AI is thinking...</span>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>

        <div style={styles.inputContainer}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={
              isProcessingVoice ? "Processing voice input..." : 
              isSpeaking ? "AI is speaking..." : 
              "Type your message or use voice input..."
            }
            style={{
              ...styles.input,
              backgroundColor: 
                isProcessingVoice ? "#e8f5e8" : 
                isSpeaking ? "#fff0e6" : 
                "#ffffff",
              borderColor: 
                isProcessingVoice ? "#28a745" : 
                isSpeaking ? "#ffc107" : 
                query ? "#667eea" : "#e9ecef",
            }}
            disabled={isProcessingVoice || isSpeaking}
          />

          <button
            onClick={toggleVoiceInput}
            disabled={!speechSupported || permissionStatus === "denied" || permissionStatus === "no-microphone"}
            style={{
              ...styles.button,
              background: (() => {
                if (!speechSupported || permissionStatus === "denied" || permissionStatus === "no-microphone") {
                  return "linear-gradient(135deg, #dc3545, #c82333)";
                }
                if (voiceEnabled) {
                  if (isSpeaking) return "linear-gradient(135deg, #fd7e14, #e55d00)";
                  return isListening ? "linear-gradient(135deg, #ffc107, #e0a800)" : "linear-gradient(135deg, #28a745, #20754d)";
                }
                return "linear-gradient(135deg, #6c757d, #5a6268)";
              })(),
              color: "#fff",
              opacity: speechSupported && permissionStatus !== "denied" ? 1 : 0.6,
            }}
          >
            {(() => {
              if (!speechSupported) return "🚫 Not Supported";
              if (permissionStatus === "denied") return "🔒 Permission Denied";
              if (permissionStatus === "no-microphone") return "🎤 No Microphone";
              if (voiceEnabled) {
                if (isSpeaking) return "🔊 AI Speaking";
                return isListening ? "🎤 Listening" : "🎤 Voice On";
              }
              return "🎤 Voice Off";
            })()}
          </button>

          <button
            onClick={() => setMuted(!muted)}
            style={{
              ...styles.button,
              background: muted ? 
                "linear-gradient(135deg, #6c757d, #5a6268)" : 
                "linear-gradient(135deg, #ffc107, #e0a800)",
              color: "#fff",
            }}
          >
            {muted ? "🔇 Muted" : "🔊 Audio"}
          </button>

          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              style={{
                ...styles.button,
                background: "linear-gradient(135deg, #dc3545, #c82333)",
                color: "#fff",
              }}
            >
              ⏹️ Stop
            </button>
          )}
        </div>

        {voiceEnabled && (
          <div style={{
            ...styles.voiceStatus,
            background: 
              isSpeaking ? "linear-gradient(135deg, #fff0e6, #ffeaa7)" :
              isProcessingVoice ? "linear-gradient(135deg, #d1ecf1, #bee5eb)" : 
              isListening ? "linear-gradient(135deg, #fff3cd, #ffeaa7)" : 
              "linear-gradient(135deg, #d4edda, #c3e6cb)",
            color: "#2c3e50",
            border: `2px solid ${
              isSpeaking ? "#ffc107" :
              isProcessingVoice ? "#17a2b8" : 
              isListening ? "#ffc107" : 
              "#28a745"
            }`,
          }}>
            {isSpeaking ? "🔊 AI is speaking - Voice input paused" :
             isProcessingVoice ? "🔄 Processing voice input..." : 
             isListening ? "🎤 Listening... Speak now!" : 
             "🎤 Voice input ready - Speak to activate"}
          </div>
        )}

        {permissionStatus === "denied" && (
          <div style={{
            ...styles.voiceStatus,
            background: "linear-gradient(135deg, #f8d7da, #f5c6cb)",
            color: "#721c24",
            border: "2px solid #f1b0b7",
          }}>
            Microphone access denied. Please enable microphone permissions in your browser settings and refresh the page.
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #764ba2, #667eea);
        }

        /* Input focus effects */
        input:focus {
          border-color: #667eea !important;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
        }

        /* Button hover effects */
        button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.15) !important;
        }

        button:active:not(:disabled) {
          transform: translateY(0);
        }

        /* Message animations */
        .message {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ChatBot;