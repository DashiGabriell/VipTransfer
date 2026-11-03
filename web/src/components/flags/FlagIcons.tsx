type FlagProps = {
  className?: string
  title?: string
  clipId?: string
}

/** Bandeira do Brasil em círculo (SVG). */
export function FlagBrazil({ className = '', title }: FlagProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="12" r="12" fill="#009B3A" />
      <path
        fill="#FEDF00"
        d="M12 4.2 19.6 12 12 19.8 4.4 12 12 4.2Z"
      />
      <circle cx="12" cy="12" r="4.15" fill="#002776" />
      <path
        fill="#fff"
        d="M8.35 11.15c1.55-.85 3.35-1.2 5.15-.95.55.08 1.08.22 1.58.4-.12.28-.2.58-.22.9-1.65-.55-3.5-.55-5.15.05-.42.15-.82.35-1.18.58-.14-.3-.2-.64-.18-.98Z"
      />
    </svg>
  )
}

/** Bandeira dos EUA em círculo (SVG). */
export function FlagUS({ className = '', title, clipId = 'flag-us-clip' }: FlagProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={clipId}>
          <circle cx="12" cy="12" r="12" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="24" height="24" fill="#fff" />
        <rect y="0" width="24" height="1.85" fill="#B22234" />
        <rect y="3.7" width="24" height="1.85" fill="#B22234" />
        <rect y="7.4" width="24" height="1.85" fill="#B22234" />
        <rect y="11.1" width="24" height="1.85" fill="#B22234" />
        <rect y="14.8" width="24" height="1.85" fill="#B22234" />
        <rect y="18.5" width="24" height="1.85" fill="#B22234" />
        <rect y="22.2" width="24" height="1.85" fill="#B22234" />
        <rect width="11.2" height="12.95" fill="#3C3B6E" />
        <g fill="#fff">
          <circle cx="2.2" cy="2" r="0.55" />
          <circle cx="4.4" cy="2" r="0.55" />
          <circle cx="6.6" cy="2" r="0.55" />
          <circle cx="8.8" cy="2" r="0.55" />
          <circle cx="3.3" cy="3.5" r="0.55" />
          <circle cx="5.5" cy="3.5" r="0.55" />
          <circle cx="7.7" cy="3.5" r="0.55" />
          <circle cx="2.2" cy="5" r="0.55" />
          <circle cx="4.4" cy="5" r="0.55" />
          <circle cx="6.6" cy="5" r="0.55" />
          <circle cx="8.8" cy="5" r="0.55" />
          <circle cx="3.3" cy="6.5" r="0.55" />
          <circle cx="5.5" cy="6.5" r="0.55" />
          <circle cx="7.7" cy="6.5" r="0.55" />
          <circle cx="2.2" cy="8" r="0.55" />
          <circle cx="4.4" cy="8" r="0.55" />
          <circle cx="6.6" cy="8" r="0.55" />
          <circle cx="8.8" cy="8" r="0.55" />
          <circle cx="3.3" cy="9.5" r="0.55" />
          <circle cx="5.5" cy="9.5" r="0.55" />
          <circle cx="7.7" cy="9.5" r="0.55" />
          <circle cx="2.2" cy="11" r="0.55" />
          <circle cx="4.4" cy="11" r="0.55" />
          <circle cx="6.6" cy="11" r="0.55" />
          <circle cx="8.8" cy="11" r="0.55" />
        </g>
      </g>
    </svg>
  )
}
