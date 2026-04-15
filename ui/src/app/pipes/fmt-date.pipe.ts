import { Pipe, PipeTransform } from '@angular/core';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];

@Pipe({ name: 'fmtDate', standalone: true })
export class FmtDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    const [y, m, d] = value.split('-');
    return `${MONTHS[+m - 1]} ${+d}, ${y}`;
  }
}
