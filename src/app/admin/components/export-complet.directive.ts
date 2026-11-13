import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { ExportExcelService, SourceExport } from '../data/export-excel.service';

/**
 * Tableau paginé : son bouton « Excel » exporte toutes les lignes (fournies par `source`) et pas
 * seulement la page affichée. Usage : `<table [appExportComplet]="exporterTout">`.
 */
@Directive({ selector: 'table[appExportComplet]', standalone: true })
export class ExportCompletDirective implements OnInit, OnDestroy {
  @Input({ required: true, alias: 'appExportComplet' }) source!: SourceExport;
  private table = inject<ElementRef<HTMLTableElement>>(ElementRef).nativeElement;
  private service = inject(ExportExcelService);

  ngOnInit(): void {
    this.service.enregistrerSource(this.table, () => this.source());
  }

  ngOnDestroy(): void {
    this.service.retirerSource(this.table);
  }
}
