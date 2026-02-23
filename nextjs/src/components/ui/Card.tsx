import Link from 'next/link';
import { ReactNode } from 'react';

interface CardProps {
  icon?: string;
  title: string;
  sub?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
  arrow?: boolean;
}

export default function Card({
  icon,
  title,
  sub,
  href,
  onClick,
  className = '',
  children,
  arrow = true,
}: CardProps) {
  const inner = (
    <>
      {icon && <div className="card-icon">{icon}</div>}
      <div className="card-body">
        <div className="card-title">{title}</div>
        {sub && <div className="card-sub">{sub}</div>}
      </div>
      {children}
      {arrow && <span className="card-arrow">›</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`card ${className}`}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={`card ${className}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      {inner}
    </div>
  );
}
