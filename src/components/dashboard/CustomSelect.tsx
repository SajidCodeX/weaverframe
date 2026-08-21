import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface Option {
  label: string;
  value: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
}

export function CustomSelect({ 
  value, 
  onChange, 
  options, 
  className,
  align = "right",
  dropDirection = "auto"
}: CustomSelectProps & { align?: "left" | "right"; dropDirection?: "auto" | "up" | "down" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleToggle = () => {
    if (!isOpen && containerRef.current && dropDirection === "auto") {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownEstimatedHeight = Math.min(options.length * 42 + 16, 240);
      
      // If space below is constrained and space above is sufficient, open upwards
      if (spaceBelow < dropdownEstimatedHeight && rect.top > dropdownEstimatedHeight) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    } else if (dropDirection === "up") {
      setOpenUpwards(true);
    } else if (dropDirection === "down") {
      setOpenUpwards(false);
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative inline-block text-left ${className || 'w-full'}`} ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between bg-input border border-border text-xs rounded-xl px-3.5 py-2.5 text-foreground outline-none hover:border-primary/50 transition-colors focus:ring-1 focus:ring-primary shadow-sm cursor-pointer"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform shrink-0 ml-2 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-[100] w-full min-w-[210px] rounded-xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
            openUpwards 
              ? "bottom-full mb-1.5 origin-bottom-right" 
              : "top-full mt-1.5 origin-top-right"
          }`}
        >
          <div className="py-1 max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`block w-full text-left px-4 py-2.5 text-xs transition-colors cursor-pointer ${
                  option.value === value
                    ? "bg-secondary text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
