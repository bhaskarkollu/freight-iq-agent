import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  constructor(private readonly sanitizer: DomSanitizer) {}

  transform(text: string | null | undefined): SafeHtml {
    if (!text) return '';
    const html = (text)
      .split('\n\n')
      .map(para =>
        `<p>${para
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/⚠️/g, '<span style="color:var(--amber)">⚠</span>')
          .replace(/✓/g, '<span style="color:var(--green)">✓</span>')
        }</p>`
      )
      .join('');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
