import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { resolveProductImage } from '../assets/productImages';

interface ProductImageProps {
  imageKey?: string;
  alt: string;
  className?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  imageKey,
  alt,
  className = 'w-full h-full object-cover',
}) => {
  const [failed, setFailed] = useState(false);
  const src = resolveProductImage(imageKey);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-2 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Package className="w-6 h-6 mb-1 text-slate-400" />
        <span className="text-[11px] font-medium text-slate-500 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
