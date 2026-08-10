import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  onSelectOption,
  placeholder = 'เลือก หรือ พิมพ์ค้นหา...',
  allowCustom = true,
  showAllOnFocus = false,
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [isTyping, setIsTyping] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setQuery(value);
    setIsTyping(false);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsTyping(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getOptText = (opt) => {
    if (typeof opt === 'string') return opt;
    return opt.formatted || (opt.code ? `${opt.code}:${opt.name}` : opt.name);
  };

  const filteredOptions = options.filter(opt => {
    const text = getOptText(opt);
    const lowerText = text.toLowerCase().trim();
    // กรองหัวข้อเทียมที่ติดมาจาก Sheet ออก
    if (lowerText === 'bank number' || lowerText === 'bank_number' || lowerText === 'ธนาคาร' || lowerText === 'เลขที่บัญชี') {
      return false;
    }

    // สำหรับช่องที่ต้องการแสดงทั้งหมดเมื่อกดคลิกเปลี่ยน (เช่น ช่องโอนเข้าบัญชี)
    if (showAllOnFocus && !isTyping) {
      return true;
    }

    const q = (query || '').toLowerCase().trim();
    // ถ้าช่องว่างเปล่า ให้แสดงตัวเลือกทั้งหมด
    if (!q) return true;

    // กรองเฉพาะรายการที่ตรงกับคำค้นหาเท่านั้น!
    if (typeof opt === 'string') {
      return opt.toLowerCase().includes(q);
    }
    const name = (opt.name || '').toLowerCase();
    const code = (opt.code || '').toLowerCase();
    const formatted = text.toLowerCase();

    return code.startsWith(q) || code.includes(q) || name.includes(q) || formatted.includes(q);
  });

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setIsTyping(true);
    setIsOpen(true);
  };

  const handleBlur = () => {
    if (!query) return;
    const q = query.trim().toLowerCase();
    const matched = options.find(opt => {
      if (typeof opt === 'object' && opt.code) {
        return opt.code.toLowerCase() === q;
      }
      return false;
    });
    if (matched) {
      const formattedText = getOptText(matched);
      setQuery(formattedText);
      onChange(formattedText);
      if (onSelectOption) onSelectOption(matched);
    }
  };

  const handleOptionClick = (opt) => {
    const text = getOptText(opt);
    setQuery(text);
    onChange(text);
    setIsTyping(false);
    if (onSelectOption) {
      onSelectOption(opt);
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={(e) => {
            if (disabled) return;
            if (!showAllOnFocus) e.target.select();
            setIsTyping(false);
            setIsOpen(true);
          }}
          onClick={() => {
            if (disabled) return;
            setIsTyping(false);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className={`w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition shadow-2xs ${disabled ? 'bg-slate-100 !text-slate-500 cursor-not-allowed opacity-90' : ''}`}
        />
        <ChevronDown
          className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none transition-transform"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>

      {isOpen && (
        <div className="absolute z-40 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl search-dropdown">
          <div className="p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const text = getOptText(opt);
                const isSelected = text === value;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleOptionClick(opt)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span>{text}</span>
                    {typeof opt === 'object' && opt.address && (
                      <span className="text-[11px] text-slate-400 truncate max-w-[200px] ml-2">
                        {opt.address}
                      </span>
                    )}
                  </button>
                );
              })
            ) : allowCustom && query.trim() ? (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ใช้ข้อความใหม่ "{query}"</span>
              </button>
            ) : (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">
                ไม่พบข้อมูลในรายการ
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
