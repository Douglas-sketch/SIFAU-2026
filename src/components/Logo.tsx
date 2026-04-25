import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  showSubtext?: boolean;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 120, showText = true, showSubtext = false, className = '' }) => {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img
        src="/sifau-icon.svg"
        width={size}
        height={size}
        alt="Logo do SIFAU"
        className="drop-shadow-xl"
        loading="eager"
      />

      {showText && (
        <div className="mt-3 text-center">
          <h1 className="text-2xl md:text-3xl font-black tracking-wider" style={{ color: 'var(--text-heading, #1e293b)' }}>
            SIFAU
          </h1>
          {showSubtext && (
            <p className="text-xs md:text-sm mt-1 tracking-wide" style={{ color: 'var(--text-secondary, #64748b)' }}>
              Sistema Inteligente de Fiscalização
              <br />e Atividades Urbanas
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
