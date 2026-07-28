import React from 'react';

interface LogoProps {
  className?: string;
  showPhone?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12" }) => {
  return (
    <svg
      viewBox="0 0 500 500"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Curved path for "MẦM NON HƯỚNG DƯƠNG" text */}
        <path
          id="topTextArch"
          d="M 65 240 A 185 185 0 0 1 435 240"
          fill="none"
        />
      </defs>

      {/* 1. Curved Top Text "MẦM NON HƯỚNG DƯƠNG" */}
      <text fill="#D32F2F" fontSize="35" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="1.5">
        <textPath href="#topTextArch" startOffset="50%" textAnchor="middle">
          MẦM NON HƯỚNG DƯƠNG
        </textPath>
      </text>

      {/* 2. Yellow Sunflower Petals Fan */}
      <g fill="#FFD500">
        <path d="M 250 110 C 240 140, 245 170, 250 185 C 255 170, 260 140, 250 110 Z" />
        <path d="M 250 185 C 230 160, 205 135, 210 115 C 225 125, 240 155, 250 185 Z" />
        <path d="M 250 185 C 270 160, 295 135, 290 115 C 275 125, 260 155, 250 185 Z" />
        <path d="M 250 185 C 215 175, 175 160, 175 140 C 195 145, 225 170, 250 185 Z" />
        <path d="M 250 185 C 285 175, 325 160, 325 140 C 305 145, 275 170, 250 185 Z" />
        <path d="M 250 185 C 200 190, 155 185, 150 170 C 170 170, 210 180, 250 185 Z" />
        <path d="M 250 185 C 300 190, 345 185, 350 170 C 330 170, 290 180, 250 185 Z" />
        <path d="M 250 185 C 190 210, 145 220, 140 200 C 160 195, 205 200, 250 185 Z" />
        <path d="M 250 185 C 310 210, 355 220, 360 200 C 340 195, 295 200, 250 185 Z" />
        <path d="M 250 185 C 190 230, 145 250, 135 230 C 155 220, 200 215, 250 185 Z" />
        <path d="M 250 185 C 310 230, 355 250, 365 230 C 345 220, 300 215, 250 185 Z" />
      </g>

      {/* 3. Center Smiling Face */}
      <circle cx="250" cy="235" r="48" fill="#FFFFFF" stroke="#A85A28" strokeWidth="8" />
      
      {/* Eyes (Smiling Arcs) */}
      <path d="M 220 220 Q 232 205 244 220" stroke="#A85A28" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M 256 220 Q 268 205 280 220" stroke="#A85A28" strokeWidth="6" strokeLinecap="round" fill="none" />

      {/* Smiling Mouth */}
      <path d="M 220 238 Q 250 272 280 238 Z" fill="#A85A28" />

      {/* 4. Green Caring Hands */}
      <g fill="#009640">
        {/* Left hand */}
        <path d="M 130 250 C 180 290, 230 330, 245 350 C 210 350, 160 320, 120 280 Z" />
        <path d="M 190 260 C 220 290, 240 320, 248 350 C 225 340, 190 300, 160 270 Z" />
        {/* Right hand */}
        <path d="M 370 250 C 320 290, 270 330, 255 350 C 290 350, 340 320, 380 280 Z" />
        <path d="M 310 260 C 280 290, 260 320, 252 350 C 275 340, 310 300, 340 270 Z" />
      </g>

      {/* 5. Phone Number */}
      <text
        x="250"
        y="380"
        textAnchor="middle"
        fill="#000000"
        fontSize="32"
        fontWeight="900"
        fontFamily="Arial, sans-serif"
      >
        0795.497.309
      </text>

      {/* 6. Semi-Circle Rainbow Arch Cradling Bottom */}
      {/* Outer Red Band */}
      <path
        d="M 45 255 A 205 205 0 0 0 455 255"
        fill="none"
        stroke="#D32F2F"
        strokeWidth="18"
      />
      {/* Middle Yellow Band */}
      <path
        d="M 63 255 A 187 187 0 0 0 437 255"
        fill="none"
        stroke="#FFD500"
        strokeWidth="18"
      />
      {/* Inner Purple/Blue Band */}
      <path
        d="M 81 255 A 169 169 0 0 0 419 255"
        fill="none"
        stroke="#2A1B7B"
        strokeWidth="18"
      />
    </svg>
  );
};
