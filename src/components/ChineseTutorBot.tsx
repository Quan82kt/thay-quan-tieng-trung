import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Volume2, Send, User, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export const ChineseTutorBot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const speakChinese = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any existing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find Chinese voice
      const voices = window.speechSynthesis.getVoices();
      const chineseVoice = voices.find(voice => 
        voice.lang.includes('zh-CN') || voice.lang.includes('zh')
      );
      
      if (chineseVoice) {
        utterance.voice = chineseVoice;
      } else {
        // Fallback to Google Translate TTS
        const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=${encodeURIComponent(text)}`;
        const audio = new Audio(fallbackUrl);
        audio.play().catch(console.error);
        return;
      }
      
      utterance.lang = 'zh-CN';
      utterance.rate = 0.8;
      
      window.speechSynthesis.speak(utterance);
    } else {
      toast({
        title: "Không hỗ trợ phát âm",
        description: "Trình duyệt của bạn không hỗ trợ tính năng phát âm.",
        variant: "destructive"
      });
    }
  };

  const callOpenRouterAPI = async (message: string): Promise<string> => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Chinese Tutor Bot'
        },
        body: JSON.stringify({
          model: 'tngtech/deepseek-r1t2-chimera:free',
          messages: [
            {
              role: 'system',
              content: `Bạn là Thầy Quân, giáo viên tiếng Trung chuyên nghiệp và thân thiện. Hãy dịch câu hỏi của học sinh sang tiếng Trung (kèm pinyin), giải thích từ vựng quan trọng và đưa 1-2 ví dụ thực tế. 
              
              Định dạng trả lời:
              
              🇨🇳 **Tiếng Trung:** [Câu tiếng Trung]
              📝 **Pinyin:** [Phiên âm pinyin]
              💡 **Giải thích:** [Giải thích từ vựng và ngữ pháp]
              📚 **Ví dụ:** [1-2 ví dụ thực tế]
              
              Hãy trả lời một cách nhiệt tình và khuyến khích học sinh học tập.`
            },
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 800
        }),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Xin lỗi, có lỗi xảy ra. Hãy thử lại!';
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      return 'Xin lỗi, hiện tại không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và thử lại!';
    }
  };

  const handleSetName = () => {
    if (inputValue.trim()) {
      setUserName(inputValue.trim());
      setIsNameSet(true);
      setInputValue('');
      
      // Add welcome message
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        content: `Chào ${inputValue.trim()}! Tôi là Thầy Quân, giáo viên tiếng Trung của bạn. Cùng nhau học tiếng Trung một cách thú vị nhé! 你好！欢迎来到我的中文课堂！`,
        sender: 'bot',
        timestamp: new Date()
      };
      
      setMessages([welcomeMessage]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const botResponse = await callOpenRouterAPI(userMessage.content);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: botResponse,
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Lỗi kết nối",
        description: "Không thể gửi tin nhắn. Vui lòng thử lại!",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isNameSet) {
        handleSetName();
      } else {
        handleSendMessage();
      }
    }
  };

  const extractChineseText = (content: string): string[] => {
    // Extract Chinese text between ** markers or find Chinese characters
    const chineseRegex = /[\u4e00-\u9fff]+/g;
    const matches = content.match(chineseRegex) || [];
    return matches;
  };

  return (
    <div className="min-h-screen bg-gradient-soft flex items-center justify-center p-4">
      <Card 
        className="w-full max-w-[380px] flex flex-col shadow-soft rounded-b-xl bg-card" 
        style={{ height: '500px' }}
      >
        {/* Header */}
        <div className="bg-gradient-chinese text-primary-foreground p-4 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-chinese-gold/20 flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Thầy Quân</h3>
              <p className="text-sm opacity-90">Giáo viên tiếng Trung</p>
            </div>
          </div>
          {isNameSet && userName && (
            <div className="mt-2 p-2 bg-chinese-gold/10 rounded-lg">
              <p className="text-sm">Chào {userName}, cùng học với Thầy Quân nhé! 🇨🇳</p>
            </div>
          )}
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {!isNameSet && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-chinese-red flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-chat-bot rounded-lg rounded-tl-none p-3 max-w-[280px]">
                  <p className="text-sm text-chinese-text">
                    Xin chào! Tôi là Thầy Quân. Bạn tên gì vậy? 😊
                  </p>
                </div>
              </div>
            )}
            
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.sender === 'user' 
                    ? 'bg-primary' 
                    : 'bg-chinese-red'
                }`}>
                  {message.sender === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className={`rounded-lg p-3 max-w-[280px] ${
                  message.sender === 'user'
                    ? 'bg-chat-user rounded-tr-none'
                    : 'bg-chat-bot rounded-tl-none'
                } ${message.sender === 'user' ? 'ml-8' : 'mr-8'}`}>
                  <div className="text-sm text-chinese-text whitespace-pre-wrap">
                    {message.content}
                  </div>
                  {message.sender === 'bot' && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {extractChineseText(message.content).map((chineseText, index) => (
                        <Button
                          key={index}
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => speakChinese(chineseText)}
                        >
                          🔊 {chineseText}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-chinese-red flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-chat-bot rounded-lg rounded-tl-none p-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-chinese-red rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-chinese-red rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-chinese-red rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={!isNameSet ? "Nhập tên của bạn..." : "Hỏi Thầy Quân về tiếng Trung..."}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={!isNameSet ? handleSetName : handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              size="icon"
              className="bg-chinese-red hover:bg-chinese-red/90"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};