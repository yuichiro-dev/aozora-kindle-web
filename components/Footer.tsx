import { Code2 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="max-w-2xl mx-auto w-full mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
      <div className="flex items-center justify-center gap-2.5">
        <p>© {new Date().getFullYear()} 青空保存 to Kindle</p>

        <span className="opacity-40">|</span>

        <a
          href="https://github.com/yuichiro-dev/aozora-kindle-web"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          aria-label="GitHub Repository"
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>GitHub</span>
        </a>

        <span className="opacity-40">|</span>

        <a
          href="https://x.com/yuichiro1dev"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          aria-label="X (Twitter)"
        >
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      </div>
    </footer>
  );
}
