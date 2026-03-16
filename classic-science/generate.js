// ========== collections/classic-science/generate.js ==========
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// ========== CONFIGURACIÓN ==========
const METADATA_FILE = path.join(__dirname, 'metadata.json');
const OUTPUT_DIR = path.join(__dirname, 'articles');
const DOMAIN = 'https://www.revistacienciasestudiantes.com';
const JOURNAL_NAME_ES = 'Revista Nacional de las Ciencias para Estudiantes';
const LOGO_ES = 'https://www.revistacienciasestudiantes.com/assets/logo.png';

// Asegurar que existe el directorio de salida
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ========== MODELO INTERMEDIO DE TABLA (del código antiguo) ==========
let tableCounter = 1;

function parseTable($, $table) {
  const table = {
    id: $table.attr('id') || `table-${tableCounter}`,
    number: tableCounter++,
    caption: $table.find('caption').text().trim() || null,
    class: $table.attr('class') || null,
    style: $table.attr('style') || null,
    headers: [],
    rows: [],
    columns: 0,
    footnotes: []
  };

  const rows = $table.find('tr');
  let headerProcessed = false;

  rows.each((i, row) => {
    const rowData = [];
    
    $(row).find('th, td').each((j, cell) => {
      const $cell = $(cell);
      
      rowData.push({
        text: $cell.text().trim().replace(/\s+/g, ' '),
        html: $cell.html(),
        colspan: parseInt($cell.attr('colspan')) || 1,
        rowspan: parseInt($cell.attr('rowspan')) || 1,
        class: $cell.attr('class') || null,
        style: $cell.attr('style') || null,
        align: $cell.attr('align') || null,
        type: cell.tagName.toLowerCase()
      });
    });

    if (!headerProcessed && ($(row).find('th').length > 0 || i === 0)) {
      table.headers = rowData;
      headerProcessed = true;
    } else {
      table.rows.push(rowData);
    }
  });

  table.columns = Math.max(
    table.headers.length,
    ...table.rows.map(r => r.reduce((sum, cell) => sum + (cell.colspan || 1), 0))
  );

  return table;
}

function formatCSVCell(text) {
  let cleanText = text.replace(/"/g, '""');
  return `"${cleanText}"`;
}

function formatCSVCell(text) {
  // Preservar notación matemática pero escapar comillas para CSV
  const preservedMath = preserveMathNotation(text);
  // Solo escapar comillas dobles para CSV, mantener todo lo demás
  let cleanText = preservedMath.replace(/"/g, '""');
  return `"${cleanText}"`;
}

function tableToCSV(table) {
  const rows = [];
  if (table.headers.length) {
    rows.push(table.headers.map(h => formatCSVCell(h.text)).join(','));
  }
  table.rows.forEach(row => {
    rows.push(row.map(cell => formatCSVCell(cell.text)).join(','));
  });
  return rows.join('\n');
}

function tableToJSON(table) {
  const simpleTable = {
    number: table.number,
    caption: preserveMathNotation(table.caption || ''),
    headers: table.headers.map(h => preserveMathNotation(h.text)),
    rows: table.rows.map(row => row.map(cell => preserveMathNotation(cell.text))),
    data: []
  };

  if (table.headers.length) {
    simpleTable.data = table.rows.map(row => {
      const obj = {};
      table.headers.forEach((header, idx) => {
        const key = header.text
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^\w]/g, '');
        obj[key] = preserveMathNotation(row[idx]?.text || '');
      });
      return obj;
    });
  }

  return JSON.stringify(simpleTable, null, 2);
}

function escapeLaTeX(text) {
  return text
    .replace(/\\/g, '\\textbackslash ')
    .replace(/_/g, '\\_')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/~/g, '\\textasciitilde ')
    .replace(/\^/g, '\\textasciicircum ');
}

function tableToLaTeX(table) {
  if (!table.rows.length && !table.headers.length) return '';

  const alignment = 'l'.repeat(table.columns);
  let latex = [];

  latex.push('\\begin{table}[h]');
  latex.push('\\centering');
  
  if (table.caption) {
    latex.push(`\\caption{${escapeLaTeXText(table.caption)}}`);
  }
  
  latex.push(`\\label{tab:${table.number}}`);
  latex.push(`\\begin{tabular}{|${alignment.split('').join('|')}|}`);
  latex.push('\\hline');

  if (table.headers.length) {
    const headerLine = table.headers
      .map(h => escapeLaTeXText(h.text))
      .join(' & ');
    latex.push(headerLine + ' \\\\');
    latex.push('\\hline');
  }

  table.rows.forEach(row => {
    const rowLine = row
      .map(cell => escapeLaTeXText(cell.text))
      .join(' & ');
    latex.push(rowLine + ' \\\\');
    latex.push('\\hline');
  });

  latex.push('\\end{tabular}');
  latex.push('\\end{table}');

  return latex.join('\n');
}
function escapeXML(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tableToXML(table) {
  let xml = [];
  
  xml.push('<?xml version="1.0" encoding="UTF-8"?>');
  xml.push(`<table id="${table.id}" number="${table.number}" xmlns="http://www.w3.org/1999/xhtml">`);

  if (table.caption) {
    xml.push(`  <caption>${escapeXML(table.caption)}</caption>`);
  }

  if (table.headers.length) {
    xml.push('  <thead>');
    xml.push('    <tr>');
    table.headers.forEach(header => {
      xml.push(`      <th>${escapeXML(header.text)}</th>`);
    });
    xml.push('    </tr>');
    xml.push('  </thead>');
  }

  xml.push('  <tbody>');
  table.rows.forEach(row => {
    xml.push('    <tr>');
    row.forEach(cell => {
      xml.push(`      <td>${escapeXML(cell.text)}</td>`);
    });
    xml.push('    </tr>');
  });
  xml.push('  </tbody>');
  
  xml.push('</table>');

  return xml.join('\n');
}

function tableToExcel(table, $) {
  // Si table es un modelo, generar HTML de la tabla
  if (table && table.headers && table.rows) {
    let html = '<table>';
    if (table.caption) html += `<caption>${table.caption}</caption>`;
    if (table.headers.length) {
      html += '<thead><tr>';
      table.headers.forEach(header => {
        html += `<th>${header.text}</th>`;
      });
      html += '</tr></thead>';
    }
    html += '<tbody>';
    table.rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td>${cell.text}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }
  
  // Si es un objeto cheerio, usar su HTML
  if ($ && $.html) {
    return $.html();
  }
  
  return '';
}
function resetTableCounter() {
  tableCounter = 1;
}

// ========== ICONOS Y SVG ==========
const orcidSvg = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" width="16" height="16"> <circle cx="128" cy="128" r="120" fill="#A6CE39"/> <g fill="#FFFFFF"> <rect x="71" y="78" width="17" height="102"/> <circle cx="79.5" cy="56" r="11"/> <path d="M103 78 v102 h41.5 c28.2 0 51-22.8 51-51 s-22.8-51-51-51 H103 zm17 17 h24.5 c18.8 0 34 15.2 34 34 s-15.2 34-34 34 H120 V95 z" fill-rule="evenodd"/> </g> </svg>`;

const emailSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;

const oaSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 500 260" style="vertical-align: middle;"><g transform="matrix(1.25 0 0 -1.25 0 360)"><path d="M262.883 200.896v-8.846h25.938v8.846c0 21.412 17.421 38.831 38.831 38.831 21.409 0 38.829-17.419 38.829-38.831v-63.985h25.939v63.985c0 35.713-29.056 64.769-64.768 64.769-35.711 0-64.769-29.056-64.769-64.769M349.153 99.568c0-11.816-9.58-21.396-21.399-21.396-11.818 0-21.398 9.58-21.398 21.396 0 11.823 9.58 21.404 21.398 21.404 11.819 0 21.399-9.581 21.399-21.404" fill="#f68212"/><path d="M277.068 99.799c0 27.811 22.627 50.436 50.438 50.436 27.809 0 50.433-22.625 50.433-50.436 0-27.809-22.624-50.438-50.433-50.438-27.811.001-50.438 22.63-50.438 50.438m-25.938 0c0-42.109 34.265-76.373 76.375-76.373 42.111 0 76.373 34.265 76.373 76.373 0 42.113-34.262 76.375-76.373 76.375-42.11 0-76.375-34.262-76.375-76.375" fill="#f68212"/></g></svg>`;

const ccLogoSvg = `<img src="https://bibliotecas.ucn.cl/wp-content/uploads/2025/04/by1.png" alt="CC BY 4.0" style="height: 1.2em; width: auto; vertical-align: middle;">`;

// Nuevo ícono para notas marginales (más intuitivo que ⦿)
const marginNoteIcon = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="display: inline-block; vertical-align: middle;"><circle cx="8" cy="8" r="6"/><path d="M8 4v5M8 11v1"/></svg>`;

// ========== SOCIAL LINKS E ICONOS ==========
const socialIcons = {
  instagram: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/><path d="M12 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4z"/><circle cx="18.406" cy="5.594" r="1.44"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
  spotify: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.508 17.308c-.221.362-.689.473-1.05.252-2.983-1.823-6.738-2.237-11.162-1.226-.411.094-.823-.162-.917-.573-.094-.412.162-.823.573-.917 4.847-1.108 8.995-.635 12.305 1.386.36.221.472.69.251 1.05zm1.47-3.255c-.278.452-.865.594-1.317.316-3.414-2.098-8.62-2.706-12.657-1.479-.508.154-1.04-.136-1.194-.644-.154-.508.136-1.04.644-1.194 4.613-1.399 10.366-.719 14.256 1.67.452.278.594.865.316 1.317zm.126-3.374C14.653 7.64 7.29 7.394 3.05 8.681c-.604.183-1.246-.166-1.429-.77-.183-.604.166-1.246.77-1.429 4.883-1.482 13.014-1.201 18.238 1.902.544.323.72 1.034.397 1.578-.323.544-1.034.72-1.578.397z"/></svg>`
};

const socialLinks = {
  instagram: 'https://www.instagram.com/revistanacionalcienciae',
  youtube: 'https://www.youtube.com/@RevistaNacionaldelasCienciaspa',
  tiktok: 'https://www.tiktok.com/@revistacienciaestudiante',
  spotify: 'https://open.spotify.com/show/6amsgUkNXgUTD219XpuqOe'
};

// ========== UTILIDADES ==========
function generateSlug(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('es-CL', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
}
// ========== NUEVA FUNCIÓN PARA PRESERVAR EXPONENTES EN TABLAS ==========
function preserveMathInTables($) {
  if (!$) return;
  
  // Buscar todas las celdas de tabla que puedan contener notación matemática
  $('td, th').each((i, cell) => {
    const $cell = $(cell);
    let html = $cell.html();
    
    // Patrones comunes de notación matemática en texto plano
    const mathPatterns = [
      // x^n o x^{n} (exponentes)
      { pattern: /(\w+)\^\{?([^\}^\s]+)\}?/g, replacement: '$1<sup>$2</sup>' },
      // x_n o x_{n} (subíndices)
      { pattern: /(\w+)_\{?([^\}^\s]+)\}?/g, replacement: '$1<sub>$2</sub>' },
      // e^x (exponente después de e)
      { pattern: /e\^\{?([^\}^\s]+)\}?/g, replacement: 'e<sup>$1</sup>' },
      // x^2 (caso específico de cuadrado)
      { pattern: /(\w+)\^2/g, replacement: '$1²' },
      // x^3 (cubo)
      { pattern: /(\w+)\^3/g, replacement: '$1³' },
      // Notación de derivada: dy/dx
      { pattern: /dy\/dx/g, replacement: '<em>dy/dx</em>' }
    ];
    
    let newHtml = html;
    let changed = false;
    
    mathPatterns.forEach(({ pattern, replacement }) => {
      if (pattern.test(newHtml)) {
        newHtml = newHtml.replace(pattern, replacement);
        changed = true;
      }
    });
    
    if (changed) {
      $cell.html(newHtml);
    }
  });
  
  // Buscar patrones específicos como "x^n" en texto plano
  $('td:contains("^"), th:contains("^")').each((i, cell) => {
    const $cell = $(cell);
    let html = $cell.html();
    
    // Caso específico: x^n donde n puede ser número o letra
    html = html.replace(/(\w+)\^(\w+)/g, '$1<sup>$2</sup>');
    $cell.html(html);
  });
  
  $('td:contains("_"), th:contains("_")').each((i, cell) => {
    const $cell = $(cell);
    let html = $cell.html();
    
    // Caso específico: x_n
    html = html.replace(/(\w+)_(\w+)/g, '$1<sub>$2</sub>');
    $cell.html(html);
  });
}
// ========== FUNCIÓN MEJORADA PARA PROCESAR NOTAS MARGINALES (MÓVIL Y ESCRITORIO) ==========
// ========== FUNCIÓN MEJORADA PARA PROCESAR NOTAS MARGINALES ==========
function processNotes($, marginNotesArray) {
  if (!$) return { marginNotes: [] };
  
  let noteCounter = 1;
  let marginCounter = 1;
  
  // IMPORTANTE: Identificar contextos matemáticos
  const mathContexts = [
    'table', 'td', 'th',  // Dentro de tablas
    '.math', '.equation',  // Clases matemáticas
    'em', 'i'              // Puede contener notación itálica matemática
  ];
  
  // Procesar notas al pie estándar - PERO ignorar si están en contexto matemático
  $('sup, .footnote, .note, .footnotemark').each((i, el) => {
    const $el = $(el);
    
    // Verificar si el elemento o su padre está en contexto matemático
    const isInMathContext = $el.parents(mathContexts.join(',')).length > 0;
    const hasMathParent = mathContexts.some(selector => $el.closest(selector).length > 0);
    
    // Si es un exponente o subíndice matemático, NO procesar como nota
    if (isInMathContext || hasMathParent) {
      // Convertir a <sup> o <sub> en lugar de nota al pie
      const text = $el.text();
      if (text.match(/^[0-9n]+$/)) { // Si el contenido es solo números o 'n'
        const $parent = $el.parent();
        const parentText = $parent.text();
        
        // Buscar patrón como x^n
        if (parentText.includes('^')) {
          const matches = parentText.match(/(\w+)\^(\w+)/);
          if (matches) {
            $parent.html($parent.html().replace(/\^(\w+)/, '<sup>$1</sup>'));
            $el.remove(); // Eliminar el marcador de nota
            return;
          }
        }
      }
      
      // Si no se pudo convertir, al menos no crear nota
      $el.replaceWith(`<sup>${$el.text()}</sup>`);
      return;
    }
    
    // Si NO está en contexto matemático, procesar como nota normal
    const noteId = `note-${noteCounter}`;
    const refId = `note-ref-${noteCounter}`;
    
    $el.attr('id', refId);
    
    const noteText = $el.text();
    const noteHtml = `
      <a href="#${noteId}" class="footnote-link" id="${refId}">
        <sup>[${noteCounter}]</sup>
      </a>
      <span class="footnote-content" id="${noteId}">
        ${noteText}
        <a href="#${refId}" class="footnote-back">↩</a>
      </span>
    `;
    
    $el.replaceWith(noteHtml);
    noteCounter++;
  });
  
  // PROCESAR NOTAS MARGINALES - con la misma lógica
  $('.marginal-note, .sidenote, .margin-note').each((i, el) => {
    const $el = $(el);
    
    // Verificar si está en contexto matemático
    const isInMathContext = $el.parents(mathContexts.join(',')).length > 0;
    
    if (isInMathContext) {
      // Si es una nota marginal en contexto matemático, probablemente es un error
      // Convertir a notación matemática en lugar de nota
      const text = $el.text();
      $el.replaceWith(`<span class="math-inline">${text}</span>`);
      return;
    }
    
    const marginId = `margin-${marginCounter}`;
    const noteText = $el.html();
    
    marginNotesArray.push({
      id: marginId,
      text: noteText,
      number: marginCounter
    });
    
    const marginIndicator = `
      <span id="${marginId}" class="margin-note-indicator-wrapper">
        <a href="#" class="margin-note-link" onclick="event.preventDefault(); openMarginNote('${marginId}', ${marginCounter});" title="Ver nota marginal">
          <span class="margin-note-badge">[Nota ${marginCounter}]</span>
        </a>
      </span>
    `;
    
    $el.replaceWith(marginIndicator);
    marginCounter++;
  });
  
  return marginNotesArray;
}
// ========== NUEVA FUNCIÓN PARA PRESERVAR MATEMÁTICAS ==========
function preserveMathNotation(text) {
  if (!text) return text;
  
  // Patrones para detectar diferentes tipos de notación matemática
  const mathPatterns = [
    // Exponentes y subíndices en formato simple (^ y _)
    { pattern: /(\w+)\^(\{?[^\}]+\}?)/g, replacement: '$1^{$2}' },
    { pattern: /(\w+)_(\{?[^\}]+\}?)/g, replacement: '$1_{$2}' },
    
    // Exponentes con múltiples caracteres entre llaves
    { pattern: /\^\{([^\}]+)\}/g, replacement: '^{$1}' },
    { pattern: /\_\{([^\}]+)\}/g, replacement: '_{$1}' },
    
    // Ecuaciones entre $$ ... $$
    { pattern: /\$\$([\s\S]+?)\$\$/g, replacement: '$$$1$$' },
    
    // Ecuaciones entre $ ... $
    { pattern: /\$([^\$]+)\$/g, replacement: '$$1$' },
    
    // Notación LaTeX común
    { pattern: /\\frac\{([^\}]+)\}\{([^\}]+)\}/g, replacement: '\\frac{$1}{$2}' },
    { pattern: /\\sqrt\{([^\}]+)\}/g, replacement: '\\sqrt{$1}' },
    { pattern: /\\int/g, replacement: '\\int' },
    { pattern: /\\sum/g, replacement: '\\sum' },
    { pattern: /\\prod/g, replacement: '\\prod' },
    { pattern: /\\lim/g, replacement: '\\lim' },
    
    // Letras griegas comunes
    { pattern: /\\alpha/g, replacement: '\\alpha' },
    { pattern: /\\beta/g, replacement: '\\beta' },
    { pattern: /\\gamma/g, replacement: '\\gamma' },
    { pattern: /\\delta/g, replacement: '\\delta' },
    { pattern: /\\epsilon/g, replacement: '\\epsilon' },
    { pattern: /\\theta/g, replacement: '\\theta' },
    { pattern: /\\lambda/g, replacement: '\\lambda' },
    { pattern: /\\mu/g, replacement: '\\mu' },
    { pattern: /\\pi/g, replacement: '\\pi' },
    { pattern: /\\sigma/g, replacement: '\\sigma' },
    { pattern: /\\omega/g, replacement: '\\omega' }
  ];
  
  // Aplicar cada patrón para normalizar la notación
  let processedText = text;
  mathPatterns.forEach(({ pattern, replacement }) => {
    processedText = processedText.replace(pattern, replacement);
  });
  
  return processedText;
}

// ========== FUNCIÓN MODIFICADA PARA ESCAPE LaTeX (SOLO TEXTO) ==========
function escapeLaTeXText(text) {
  // Primero, preservar la notación matemática
  const withMath = preserveMathNotation(text);
  
  // Luego, escapar SOLO los caracteres que NO son parte de comandos LaTeX válidos
  return withMath
    // Escapar &, %, $, #, {, }, ~ fuera de comandos
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/~/g, '\\textasciitilde ')
    // NO escapar ^ y _ que forman parte de notación matemática válida
    // Solo escapar si están sueltos y no seguidos de { o un comando
    .replace(/([^\\])\^([^\{])/g, '$1\\textasciicircum $2')
    .replace(/([^\\])_([^\{])/g, '$1\\_$2')
    // Escapar backslashes que no sean parte de comandos
    .replace(/\\(?!alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|frac|sqrt|int|sum|prod|lim)/g, '\\textbackslash ');
}
function processRichContent($, specialElementsArray) {
  if (!$) return specialElementsArray;
  
  let figureIndex = 0;
  let tableIndex = 0;
  let codeIndex = 0;
  let equationIndex = 0;
  
  // ===== PROCESAR ECUACIONES CON ANOTACIONES (NUEVO) =====
  function processEquationsWithAnnotations($) {
    if (!$) return;
    
    // Buscar ecuaciones con anotaciones especiales
    $('.equation-with-annotation, .math-annotation-wrapper').each((i, el) => {
      const $el = $(el);
      const annotation = $el.attr('data-annotation') || '';
      const annotationSide = $el.attr('data-side') || 'right';
      
      if (annotation) {
        $el.wrap('<div class="equation-specimen"></div>');
        
        // Añadir anotación al margen
        const annotationHtml = `
          <div class="math-annotation ${annotationSide === 'left' ? 'left' : ''}">
            ${annotation}
          </div>
        `;
        
        $el.before(annotationHtml);
      }
    });
    
    // Procesar variables con tooltips
    $('.math-variable-tooltip').each((i, el) => {
      const $el = $(el);
      const variableName = $el.attr('data-variable') || '';
      const variableDesc = $el.attr('data-description') || '';
      
      if (variableName && variableDesc) {
        $el.attr('data-mjx-variable', variableDesc);
      }
    });
  }

  // ===== PROCESAR BLOQUES DE CÓDIGO =====
  $('pre').each((i, el) => {
    const $el = $(el);
    
    if ($el.parent().hasClass('code-block-wrapper')) {
      return;
    }
    
    let $codeElement = $el.find('code').first();
    let code;
    let language = '';
    
    if ($codeElement.length > 0) {
      code = $codeElement.text();
      const classAttr = $codeElement.attr('class') || '';
      if (classAttr.includes('language-')) {
        language = classAttr.split('language-')[1].split(' ')[0];
      } else if (classAttr.includes('lang-')) {
        language = classAttr.split('lang-')[1].split(' ')[0];
      }
    } else {
      code = $el.text();
    }
    
    const lines = code.split('\n');
    const lineCount = lines.length;
    
    let lineNumbersHtml = '';
    for (let i = 1; i <= lineCount; i++) {
      lineNumbersHtml += `<span class="code-line-number">${i}</span>`;
    }
    
    codeIndex++;
    const codeId = `code-${codeIndex}`;
    
    specialElementsArray.push({
      type: 'code',
      id: codeId,
      title: language ? `Código (${language})` : `Código ${codeIndex}`
    });
    
    const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // SVG para el botón copiar
    const copySvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    
    const codeHtml = `
      <div class="code-block-wrapper" id="${codeId}">
        <div class="code-header">
          <span class="code-language">${language || 'código'}</span>
          <button class="code-copy-btn" onclick="copyCode('${codeId}', this)" title="Copiar código">
            ${copySvg}
            <span class="copy-text">Copiar</span>
          </button>
        </div>
        <div class="code-block-container">
          <div class="code-line-numbers" aria-hidden="true">
            ${lineNumbersHtml}
          </div>
          <pre class="code-block ${language ? `language-${language}` : ''}"><code class="${language ? `language-${language}` : ''}">${escapedCode}</code></pre>
        </div>
      </div>
    `;
    
    $el.replaceWith(codeHtml);
  });

  // ===== PROCESAR TABLAS =====
  $('table').each((i, el) => {
    const $el = $(el);
    
    if ($el.parent().hasClass('table-download-wrapper')) {
      return;
    }
    
    const tableModel = parseTable($, $el);
    const tableNumber = tableModel.number;
    const tableId = `table-${tableNumber}`;
    
    $el.attr('id', tableId);
    $el.addClass('article-table');
    
    specialElementsArray.push({
      type: 'table',
      id: tableId,
      title: tableModel.caption || `Tabla ${tableNumber}`
    });
    
    const csvContent = tableToCSV(tableModel);
    const jsonContent = tableToJSON(tableModel);
    const latexContent = tableToLaTeX(tableModel);
    const xmlContent = tableToXML(tableModel);
    const excelContent = tableToExcel(tableModel);
    
    const BOM = '\uFEFF';
    
    // SVG icons para los botones
    const csvSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12h6"/><path d="M9 16h6"/><path d="M9 8h3"/><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
    const excelSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`;
    const jsonSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 20c-1.5 0-2.5-1-2.5-2.5v-3.5c0-1-1-1.5-2-1.5s-2-.5-2-1.5v-1c0-1 1-1.5 2-1.5s2-.5 2-1.5v-3.5c0-1.5 1-2.5 2.5-2.5"/><path d="M14 4c1.5 0 2.5 1 2.5 2.5v3.5c0 1 1 1.5 2 1.5s2 .5 2 1.5v1c0 1-1 1.5-2 1.5s-2 .5-2 1.5v3.5c0 1.5-1 2.5-2.5 2.5"/></svg>`;
    const latexSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 4h-12l7 8-7 8h12"/></svg>`;
    const xmlSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
    
    const tableWrapper = `
      <div class="table-download-wrapper" id="${tableId}-wrapper">
        <div class="table-header">
          <span class="table-label">Tabla ${tableNumber}${tableModel.caption ? ': ' + tableModel.caption : ''}</span>
          <div class="table-download-buttons">
            <a href="data:text/csv;charset=utf-8,${encodeURIComponent(BOM + csvContent)}"
               download="tabla-${tableNumber}.csv"
               class="table-download-btn" title="Descargar como CSV">
              ${csvSvg}
              <span>CSV</span>
            </a>
            <a href="data:application/vnd.ms-excel;charset=utf-8,${encodeURIComponent(BOM + excelContent)}"
               download="tabla-${tableNumber}.xls"
               class="table-download-btn" title="Descargar como Excel">
              ${excelSvg}
              <span>Excel</span>
            </a>
            <a href="data:application/json;charset=utf-8,${encodeURIComponent(jsonContent)}"
               download="tabla-${tableNumber}.json"
               class="table-download-btn" title="Descargar como JSON">
              ${jsonSvg}
              <span>JSON</span>
            </a>
            <a href="data:text/plain;charset=utf-8,${encodeURIComponent(latexContent)}"
               download="tabla-${tableNumber}.tex"
               class="table-download-btn" title="Descargar como LaTeX">
              ${latexSvg}
              <span>LaTeX</span>
            </a>
            <a href="data:application/xml;charset=utf-8,${encodeURIComponent(xmlContent)}"
               download="tabla-${tableNumber}.xml"
               class="table-download-btn" title="Descargar como XML">
              ${xmlSvg}
              <span>XML</span>
            </a>
          </div>
        </div>
        <div class="table-wrapper">
          ${$.html($el)}
        </div>
      </div>
    `;
    
    $el.replaceWith(tableWrapper);
  });
  
  // ===== PROCESAR IMÁGENES =====
  $('img').each((i, el) => {
    const $el = $(el);
    
    if ($el.parent().hasClass('image-link') || $el.parent().is('a')) {
      return;
    }
    
    const alt = $el.attr('alt') || '';
    const src = $el.attr('src') || '';
    const style = $el.attr('style') || '';
    const align = $el.attr('align') || '';
    
    $el.addClass('article-image');
    
    let floatClass = '';
    if (style.includes('float: left') || align === 'left') {
      floatClass = ' float-left';
    } else if (style.includes('float: right') || align === 'right') {
      floatClass = ' float-right';
    }
    
    figureIndex++;
    const figureId = `figure-${figureIndex}`;
    
    specialElementsArray.push({
      type: 'figure',
      id: figureId,
      title: alt || `Figura ${figureIndex}`
    });
    
    if (src) {
      $el.wrap(`<a href="${src}" target="_blank" rel="noopener noreferrer" class="image-link"></a>`);
    }
    
    if (alt) {
      $el.parent().wrap(`<figure class="image-figure${floatClass}" id="${figureId}"></figure>`);
      $el.parent().after(`<figcaption class="image-caption">${alt}</figcaption>`);
    } else {
      $el.parent().wrap(`<figure class="image-figure${floatClass}" id="${figureId}"></figure>`);
    }
  });
  
  // ===== PROCESAR ECUACIONES =====
  $('.MathJax_Display, .math-container, .equation').each((i, el) => {
    const $el = $(el);
    
    if ($el.attr('id') && $el.attr('id').startsWith('equation-')) {
      return;
    }
    
    equationIndex++;
    const equationId = `equation-${equationIndex}`;
    $el.attr('id', equationId);
    
    specialElementsArray.push({
      type: 'equation',
      id: equationId,
      title: `Ecuación ${equationIndex}`
    });
  });
  
  // ===== PROCESAR ECUACIONES CON ANOTACIONES (NUEVO) =====
  processEquationsWithAnnotations($);
  
  return specialElementsArray;
}
// ========== FUNCIÓN PARA PROCESAR AUTORES CON ICONOS ==========
function processAuthorsWithIcons(authors) {
  if (!authors || !Array.isArray(authors)) return 'Autor desconocido';
  
  return authors.map(author => {
    let authorHtml = '';
    
    if (author.link) {
      authorHtml += `<a href="${author.link}" target="_blank" rel="noopener" class="author-link">${author.name}</a>`;
    } else {
      authorHtml += `<span class="author-name">${author.name}</span>`;
    }
    
    // Añadir icono de información con modal
    authorHtml += `<span class="author-info-icon" onclick="openAuthorModal('${generateSlug(author.name)}')" title="Información del autor">ⓘ</span>`;
    
    // Añadir iconos de ORCID y email si existen
    const icons = [];
    if (author.orcid) {
      icons.push(`<a href="https://orcid.org/${author.orcid}" target="_blank" class="author-icon orcid-icon" title="ORCID">${orcidSvg}</a>`);
    }
    if (author.email) {
      icons.push(`<a href="mailto:${author.email}" class="author-icon email-icon" title="Email">${emailSvg}</a>`);
    }
    
    if (icons.length > 0) {
      authorHtml += `<span class="author-icons">${icons.join('')}</span>`;
    }
    
    return authorHtml;
  }).join('<span class="author-separator">, </span>');
}

// ========== FUNCIÓN PARA GENERAR MODALES DE AUTORES ==========
function generateAuthorModals(authors) {
  if (!authors || !Array.isArray(authors)) return '';
  
  return authors.map(author => {
    const authorId = generateSlug(author.name);
    const birthDate = author['birth-date'] ? formatDate(author['birth-date']) : 'Desconocida';
    const deathDate = author['death-date'] ? formatDate(author['death-date']) : '—';
    
    return `
    <div id="author-modal-${authorId}" class="author-modal">
      <div class="author-modal-content">
        <span class="author-modal-close" onclick="closeAuthorModal('${authorId}')">&times;</span>
        <h3>${author.name}</h3>
        <p class="author-dates">${birthDate} - ${deathDate}</p>
        <div class="author-bio">${author.bio || 'Sin biografía disponible.'}</div>
        ${author.link ? `<p><a href="${author.link}" target="_blank" rel="noopener">Ver perfil externo →</a></p>` : ''}
      </div>
    </div>
    `;
  }).join('');
}

// ========== FUNCIÓN PARA PROCESAR COLABORADORES ==========
function processCollaborators(colaboradores) {
  if (!colaboradores || !Array.isArray(colaboradores)) return '';
  
  return colaboradores.map(col => {
    let colHtml = `<div class="collaborator-item">`;
    colHtml += `<span class="collaborator-name">`;
    
    if (col.link) {
      colHtml += `<a href="${col.link}" target="_blank" rel="noopener">${col.name}</a>`;
    } else {
      colHtml += col.name;
    }
    
    colHtml += `</span>`;
    colHtml += `<span class="collaborator-role">${col.role || 'Colaborador'}</span>`;
    
    const icons = [];
    if (col.orcid) {
      icons.push(`<a href="https://orcid.org/${col.orcid}" target="_blank" class="author-icon" title="ORCID">${orcidSvg}</a>`);
    }
    if (col.email) {
      icons.push(`<a href="mailto:${col.email}" class="author-icon" title="Email">${emailSvg}</a>`);
    }
    
    if (icons.length > 0) {
      colHtml += `<span class="author-icons">${icons.join('')}</span>`;
    }
    
    colHtml += `</div>`;
    return colHtml;
  }).join('');
}
// ========== FUNCIÓN PARA GENERAR TOC CON IDS CORRECTOS ==========
function generateTOC(html, specialElements = []) {
  if (!html) return [];
  
  const $ = cheerio.load(html, { decodeEntities: false });
  const toc = [];
  const usedIds = new Set(); // Para evitar IDs duplicados
  
  // Primero, los encabezados h2, h3, h4
  $('h2, h3, h4').each((i, el) => {
    const $el = $(el);
    const level = parseInt(el.tagName[1]);
    let text = $el.text().trim();
    
    if (!text) return; // Saltar encabezados vacíos
    
    // Generar ID único basado en el texto
    let baseId = generateSlug(text);
    let id = baseId;
    let counter = 1;
    
    // Asegurar unicidad
    while (usedIds.has(id)) {
      id = `${baseId}-${counter}`;
      counter++;
    }
    
    usedIds.add(id);
    $el.attr('id', id);
    
    toc.push({
      level,
      id,
      text,
      type: 'heading'
    });
  });
  
  return toc;
}

// ========== FUNCIÓN PARA FORMATEAR FECHA CORRECTAMENTE ==========
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  
  // Intentar parsear la fecha
  try {
    // Si es formato DD-MM-YYYY
    if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const [day, month, year] = dateStr.split('-');
      return new Date(year, month-1, day).toLocaleDateString('es-CL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
    
    // Si es formato ISO
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('es-CL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
    
    return dateStr; // Devolver el string original si no se puede parsear
  } catch (e) {
    return dateStr;
  }
}

// ========== FUNCIÓN PARA PROCESAR CITAS CON FECHAS Y ROLES CORRECTOS ==========
function processCitations(article) {
  if (!article) return {};
  
  // Formatear fechas correctamente
  const originalDate = article['original-date'] || '';
  const publicationDate = article.date ? formatDate(article.date) : formatDate(new Date());
  
  // Extraer año de publicación original
  let originalYear = 's.f.';
  if (originalDate) {
    try {
      if (originalDate.match(/^\d{2}-\d{2}-\d{4}$/)) {
        originalYear = originalDate.split('-')[2];
      } else {
        const date = new Date(originalDate);
        if (!isNaN(date.getTime())) {
          originalYear = date.getFullYear().toString();
        }
      }
    } catch (e) {
      originalYear = originalDate;
    }
  }
  
  // Año de la traducción (usar fecha actual o la del artículo)
  const translationYear = article.date ? 
    (article.date.match(/^\d{2}-\d{2}-\d{4}$/) ? article.date.split('-')[2] : new Date().getFullYear().toString()) : 
    new Date().getFullYear().toString();
  
  // Obtener autor principal
  let authorFormatted = 'Autor desconocido';
  let authorLastName = 'Autor';
  let authorInitial = 'A.';
  
  if (article.author && article.author[0]) {
    const author = article.author[0];
    const nameParts = author.name.split(' ');
    
    if (nameParts.length >= 2) {
      // Asumimos que el apellido es la última palabra
      authorLastName = nameParts.pop();
      authorInitial = nameParts[0].charAt(0) + '.';
      authorFormatted = `${authorLastName}, ${authorInitial}`;
    } else {
      authorLastName = author.name;
      authorInitial = author.name.charAt(0) + '.';
      authorFormatted = author.name;
    }
  }
  
  // Obtener traductor (de colaboradores con rol "Traductor")
  let translator = null;
  if (article.colaboradores && Array.isArray(article.colaboradores)) {
    const translatorObj = article.colaboradores.find(col => 
      col.role && col.role.toLowerCase().includes('traductor')
    );
    if (translatorObj) {
      translator = translatorObj.name;
    }
  }
  
  // Si no hay traductor en colaboradores, buscar en editores
  if (!translator && article.editor && Array.isArray(article.editor)) {
    // Podríamos asumir que el primer editor es el traductor si no se especifica
    // Pero mejor dejarlo como null
  }
  
  // Obtener editor(es)
  let editors = [];
  if (article.editor && Array.isArray(article.editor)) {
    editors = article.editor.map(ed => ed.name);
  }
  
  // Títulos
  const titleTranslated = article['name-translated'] || article['name-original'];
  const titleOriginal = article['name-original'] || '';
  
  // URL del artículo
  const articleUrl = article.id ? 
    `https://www.revistacienciasestudiantes.com/collections/classic-science/articles/${article.id}.html` : 
    '';
  
  // Formato APA: Autor original. (Año de la traducción). Título del texto traducido 
  // (Nombre del traductor, Trad.; Nombre del editor, Ed.). Nombre de la revista, Colección o serie editorial. URL
  let apaCitation = '';
  if (translator && editors.length > 0) {
    // Con traductor y editor
    apaCitation = `${authorFormatted} (${translationYear}). ${titleTranslated} (${translator}, Trad.; ${editors.join(' & ')}, Eds.). <em>Clásicos de la Ciencia</em>. ${articleUrl}`;
  } else if (translator) {
    // Solo traductor
    apaCitation = `${authorFormatted} (${translationYear}). ${titleTranslated} (${translator}, Trad.). <em>Clásicos de la Ciencia</em>. ${articleUrl}`;
  } else if (editors.length > 0) {
    // Solo editor
    apaCitation = `${authorFormatted} (${translationYear}). ${titleTranslated} (${editors.join(' & ')}, Eds.). <em>Clásicos de la Ciencia</em>. ${articleUrl}`;
  } else {
    // Sin traductor ni editor
    apaCitation = `${authorFormatted} (${translationYear}). ${titleTranslated}. <em>Clásicos de la Ciencia</em>. ${articleUrl}`;
  }
  
  // Formato MLA: Autor original. "Título del texto traducido." Nombre de la revista, 
  // traducido por Nombre Apellido, editado por Nombre Apellido, colección editorial, año, URL.
  let mlaCitation = '';
  const authorFull = article.author && article.author[0] ? article.author[0].name : 'Autor desconocido';
  
  if (translator && editors.length > 0) {
    // Con traductor y editor
    mlaCitation = `${authorFull}. "${titleTranslated}." <em>Clásicos de la Ciencia</em>, traducido por ${translator}, editado por ${editors.join(' y ')}, ${translationYear}, ${articleUrl}.`;
  } else if (translator) {
    // Solo traductor
    mlaCitation = `${authorFull}. "${titleTranslated}." <em>Clásicos de la Ciencia</em>, traducido por ${translator}, ${translationYear}, ${articleUrl}.`;
  } else if (editors.length > 0) {
    // Solo editor
    mlaCitation = `${authorFull}. "${titleTranslated}." <em>Clásicos de la Ciencia</em>, editado por ${editors.join(' y ')}, ${translationYear}, ${articleUrl}.`;
  } else {
    // Sin traductor ni editor
    mlaCitation = `${authorFull}. "${titleTranslated}." <em>Clásicos de la Ciencia</em>, ${translationYear}, ${articleUrl}.`;
  }
  
  // Formato Chicago: Autor original. "Título del texto traducido." Traducido por Nombre Apellido. 
  // Editado por Nombre Apellido. Nombre de la revista, colección editorial, Año. URL.
  let chicagoCitation = '';
  
  if (translator && editors.length > 0) {
    // Con traductor y editor
    chicagoCitation = `${authorFull}. "${titleTranslated}." Traducido por ${translator}. Editado por ${editors.join(' y ')}. <em>Clásicos de la Ciencia</em>, ${translationYear}. ${articleUrl}.`;
  } else if (translator) {
    // Solo traductor
    chicagoCitation = `${authorFull}. "${titleTranslated}." Traducido por ${translator}. <em>Clásicos de la Ciencia</em>, ${translationYear}. ${articleUrl}.`;
  } else if (editors.length > 0) {
    // Solo editor
    chicagoCitation = `${authorFull}. "${titleTranslated}." Editado por ${editors.join(' y ')}. <em>Clásicos de la Ciencia</em>, ${translationYear}. ${articleUrl}.`;
  } else {
    // Sin traductor ni editor
    chicagoCitation = `${authorFull}. "${titleTranslated}." <em>Clásicos de la Ciencia</em>, ${translationYear}. ${articleUrl}.`;
  }
  
  // Formato BibTeX
  let bibtexCitation = `@article{${generateSlug(authorLastName)}_${originalYear}_${generateSlug(titleTranslated).substring(0, 20)},
  author       = {${article.author && article.author[0] ? article.author[0].name : 'Autor Desconocido'}},
  title        = {${titleTranslated}},
  journaltitle = {Revista Nacional de las Ciencias para Estudiantes},
  series       = {Clásicos de la Ciencia},`;
  
  if (translator) {
    bibtexCitation += `\n  translator   = {${translator}},`;
  }
  
  if (editors.length > 0) {
    bibtexCitation += `\n  editor       = {${editors.join(' and ')}},`;
  }
  
  bibtexCitation += `\n  year         = {${translationYear}},`;
  
  if (originalYear !== 's.f.') {
    bibtexCitation += `\n  origdate     = {${originalYear}},`;
  }
  
  bibtexCitation += `\n  url          = {${articleUrl}}
}`;
  
  return {
    apa: apaCitation,
    mla: mlaCitation,
    chicago: chicagoCitation,
    bibtex: bibtexCitation,
    originalDate: originalDate,
    publicationDate: publicationDate
  };
}
// ========== FUNCIÓN PRINCIPAL DE GENERACIÓN ==========
async function generateAll() {
  console.log('🚀 Iniciando generación de la colección "Clásicos de la Ciencia"...');
  
  try {
    // 1. Leer metadata.json
    if (!fs.existsSync(METADATA_FILE)) {
      throw new Error(`No se encuentra ${METADATA_FILE}`);
    }
    
    const articles = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    console.log(`📄 ${articles.length} artículos cargados`);

    // 2. Generar HTML para cada artículo
    for (const article of articles) {
      await generateArticleHtml(article);
    }

    // 3. Generar índice de la colección
    generateCollectionIndex(articles);

    console.log('🎉 ¡Proceso completado con éxito!');
    
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}
async function generateArticleHtml(article) {
  // Validar ID
  if (!article.id || !article.id.match(/^CC-\d{4}-\d{4}$/)) {
    console.warn(`⚠️ ID inválido para artículo: ${article.id || 'sin ID'}`);
  }
  
  const articleSlug = generateSlug(article['name-translated'] || article['name-original']);
  const outputFile = path.join(OUTPUT_DIR, `${article.id}.html`);
  
  // --- NUEVO: Arrays para recolectar elementos de TODAS las secciones ---
  const allMarginNotes = [];
  const allSpecialElements = [];
  
  function processHtmlFragment(htmlContent, prefix = '') {
  if (!htmlContent) return { processed: '', marginNotes: [], specialElements: [] };
  
  // PASO 1: Limpieza EXTREMA - eliminar TODAS las etiquetas de documento
  let cleanedHtml = htmlContent
    // Eliminar DOCTYPE
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    // Eliminar TODAS las etiquetas html, head, body con o sin atributos
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[^>]*>/gi, '')
    .replace(/<\/head>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    // Eliminar también variantes con espacios o atributos raros
    .replace(/<html\b[^>]*>/gi, '')
    .replace(/<head\b[^>]*>/gi, '')
    .replace(/<body\b[^>]*>/gi, '')
    // Eliminar posibles etiquetas de cierre mal formadas
    .replace(/<\/html\s*>/gi, '')
    .replace(/<\/head\s*>/gi, '')
    .replace(/<\/body\s*>/gi, '')
    .trim();

  // PASO 2: Si aún quedan, hacer una limpieza más profunda con regex
  cleanedHtml = cleanedHtml.replace(/<\/?(html|head|body)(\s+[^>]*)?>/gi, '');
  
  // PASO 3: Extraer solo el contenido si hay etiquetas anidadas
  const bodyMatch = cleanedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    cleanedHtml = bodyMatch[1];
  }
  
  // PASO 4: Eliminar cualquier etiqueta html/head/body que pueda haber quedado
  cleanedHtml = cleanedHtml
    .replace(/<\/?(html|head|body)[^>]*>/gi, '')
    .trim();

  // ========== ¡¡¡ CAMBIO CLAVE AQUÍ !!! ==========
  // PASO 5: Cargar el HTML limpio CON xmlMode: true
  // Esto evita que Cheerio añada <html>, <head>, <body> automáticamente.
  const $fragment = cheerio.load(cleanedHtml, { 
    decodeEntities: false,
    xmlMode: true // <--- ESTA ES LA LÍNEA MÁGICA
  });
  
  // Eliminar scripts de live-server si existen
  $fragment('script').each((i, el) => {
    const src = $fragment(el).attr('src');
    if (src && src.includes('live-server')) {
      $fragment(el).remove();
    }
  });
  
  const fragmentMarginNotes = [];
  const fragmentSpecialElements = [];
  
  // Procesar notas y marginalia
  processNotes($fragment, fragmentMarginNotes);
  processRichContent($fragment, fragmentSpecialElements);
  
  // Asignar IDs a encabezados con prefijo
  $fragment('h2, h3, h4').each((i, el) => {
    const $el = $fragment(el);
    const text = $el.text().trim();
    if (!text) return;
    if (!$el.attr('id')) {
      const level = parseInt(el.tagName[1]);
      const baseId = generateSlug(text) || `seccion-${level}-${Date.now()}-${i}`;
      const id = prefix ? `${prefix}-${baseId}` : baseId;
      $el.attr('id', id);
    }
  });
  
  // ========== Y AQUÍ AL OBTENER EL HTML ==========
  return {
    // Al hacer xmlMode: true, .html() YA NO AÑADIRÁ LA ESTRUCTURA COMPLETA.
    processed: $fragment.html(),
    marginNotes: fragmentMarginNotes,
    specialElements: fragmentSpecialElements
  };
}
  // ================================================================
  // 1. PROCESAR HTML PRINCIPAL
  // ================================================================
  const mainResult = processHtmlFragment(article.html || '', 'main');
  const mainHtml = mainResult.processed;
  allMarginNotes.push(...mainResult.marginNotes);
  allSpecialElements.push(...mainResult.specialElements);
  
  // ================================================================
  // 2. PROCESAR APÉNDICE (si existe)
  // ================================================================
  let processedAppendix = '';
  if (article.appendix) {
    const appendixResult = processHtmlFragment(article.appendix, 'appendix');
    processedAppendix = appendixResult.processed;
    allMarginNotes.push(...appendixResult.marginNotes);
    allSpecialElements.push(...appendixResult.specialElements);
  }
  
  // ================================================================
  // 3. PROCESAR REFERENCIAS (si existen)
  // ================================================================
  let processedReferences = '';
  if (article.references) {
    const referencesResult = processHtmlFragment(article.references, 'ref');
    processedReferences = referencesResult.processed;
    allMarginNotes.push(...referencesResult.marginNotes);
    allSpecialElements.push(...referencesResult.specialElements);
  }
  
  // ================================================================
  // 4. PROCESAR NOTA EDITORIAL (si existe)
  // ================================================================
  let processedEditorialNote = '';
  if (article['editorial-note']) {
    const editorialResult = processHtmlFragment(article['editorial-note'], 'editorial');
    processedEditorialNote = editorialResult.processed;
    allMarginNotes.push(...editorialResult.marginNotes);
    allSpecialElements.push(...editorialResult.specialElements);
  }
  
  // ================================================================
  // 5. GENERAR TOC CON TODAS LAS SECCIONES
  // ================================================================
  // Crear un documento combinado para generar el TOC completo
  const combinedHtml = `
    ${mainHtml}
    ${processedAppendix ? '<div class="appendix-wrapper">' + processedAppendix + '</div>' : ''}
    ${processedReferences ? '<div class="references-wrapper">' + processedReferences + '</div>' : ''}
  `;
  
  const $combined = cheerio.load(combinedHtml, { decodeEntities: false });
  
  // Generar TOC
  const tocHeadings = [];
  $combined('h2, h3, h4').each((i, el) => {
    const $el = $combined(el);
    const level = parseInt(el.tagName[1]);
    const text = $el.text().trim();
    const id = $el.attr('id');
    
    if (text && id) {
      tocHeadings.push({
        level,
        id,
        text,
        type: 'heading'
      });
    }
  });
  
  // TOC completo con secciones especiales
  const fullToc = [
    ...(article.abstract ? [{
      level: 2,
      id: 'abstract',
      text: 'Resumen',
      type: 'heading'
    }] : []),
    ...(processedEditorialNote ? [{
      level: 2,
      id: 'editorial-note',
      text: 'Nota de la edición',
      type: 'heading'
    }] : []),
    ...tocHeadings,
    ...(processedReferences ? [{
      level: 2,
      id: 'references',
      text: 'Referencias',
      type: 'heading'
    }] : []),
    ...(processedAppendix ? [{
      level: 2,
      id: 'appendix',
      text: 'Apéndice',
      type: 'heading'
    }] : [])
  ];
  
  // Añadir elementos especiales
  allSpecialElements.forEach(el => {
    fullToc.push({
      level: 4,
      id: el.id,
      text: el.title,
      type: el.type
    });
  });
  
  // ================================================================
  // 6. PROCESAR AUTORES Y COLABORADORES
  // ================================================================
  const authorsDisplay = processAuthorsWithIcons(article.author);
  const authorModals = generateAuthorModals(article.author);
  const collaboratorsHtml = processCollaborators(article.colaboradores);
  const citations = processCitations(article);
    // ================================================================
  // 7. PROCESAR PDF PARA PREVISUALIZACIÓN (NUEVO - CORREGIDO)
  // ================================================================
  let pdfPreviewHtml = '';
  if (article['pdf-url']) {
    pdfPreviewHtml = `
      <section id="pdf-preview" class="pdf-preview-section">
        <h2>${article['name-translated'] ? 'Visualización del PDF' : 'PDF Preview'}</h2>
        <div class="pdf-preview-container">
          <embed src="${article['pdf-url']}" 
                 type="application/pdf" 
                 class="pdf-embed" 
                 title="Previsualización del PDF" />
        </div>
        <div class="pdf-actions">
          <a href="${article['pdf-url']}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="btn-pdf btn-open">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            ${article['name-translated'] ? 'Abrir PDF en nueva pestaña' : 'Open PDF in new tab'}
          </a>
          <a href="${article['pdf-url']}" 
             download 
             class="btn-pdf btn-download">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            ${article['name-translated'] ? 'Descargar PDF' : 'Download PDF'}
          </a>
        </div>
      </section>
    `;
  }
  // ================================================================
  // 7. GENERAR HTML FINAL
  // ================================================================
  const htmlContent = generateHtmlTemplate({
    article,
    articleSlug,
    authorsDisplay,
    authorModals,
    collaboratorsHtml,
    toc: fullToc,
    marginNotes: allMarginNotes,
    processedHtml: mainHtml,
    referencesHtml: processedReferences,
    appendixHtml: processedAppendix,
    editorialNoteHtml: processedEditorialNote,
    specialElements: allSpecialElements,
    citations,
    pdfPreviewHtml
  });

  fs.writeFileSync(outputFile, htmlContent, 'utf8');
  console.log(`✅ Generado: ${outputFile}`);
}
function generateHtmlTemplate({
  article,
  articleSlug,
  authorsDisplay,
  authorModals,
  collaboratorsHtml,
  toc,
  marginNotes,
  processedHtml,        // HTML principal procesado
  referencesHtml,        // Referencias procesadas
  appendixHtml,          // Apéndice procesado
  editorialNoteHtml,     // Nota editorial procesada
  specialElements,
  citations,
  pdfPreviewHtml  
}) {
  const hasSpanishTitle = article['name-translated'] && article['name-translated'].trim() !== '';
  const hasOriginalTitle = article['name-original'] && article['name-original'].trim() !== '';

  // Título principal (traducido)
  const title = hasSpanishTitle ? article['name-translated'] : article['name-original'];
  
  // Título original (para mostrar como subtítulo)
  const originalTitle = hasOriginalTitle && hasSpanishTitle ? article['name-original'] : '';
  
  // Generar TOC HTML
  const tocHtml = toc.map(item => {
    const indent = '&nbsp;'.repeat((item.level - 2) * 4);
    
let icon = '';
if (item.type === 'figure') {
  icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display: inline-block; margin-right: 4px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15L16 10 5 21"/></svg> `;
} else if (item.type === 'table') {
  icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display: inline-block; margin-right: 4px;"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm0 5h18M10 3v18"/></svg> `;
} else if (item.type === 'code') {
  icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display: inline-block; margin-right: 4px;"><path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16"/></svg> `;
} else if (item.type === 'equation') {
  icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display: inline-block; margin-right: 4px;"><path d="M4 7h3a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2h3"/><path d="M7 11h4"/><path d="M17 7h.01"/><circle cx="18.5" cy="15.5" r="2.5"/></svg> `;
}
    
    return `
    <li class="toc-item toc-level-${item.level} ${item.type !== 'heading' ? 'toc-special' : ''}">
      <a href="#${item.id}">${indent}${icon}${item.text}</a>
    </li>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="citation_title" content="${title.replace(/"/g, '&quot;')}">
  <meta name="citation_publication_date" content="${article['original-date'] || ''}">
  <meta name="citation_journal_title" content="Revista Nacional de las Ciencias para Estudiantes - Clásicos de la Ciencia">
  <meta name="citation_issn" content="3087-2839">
  <meta name="citation_pdf_url" content="${article['pdf-url'] || ''}">
  <meta name="citation_abstract" content="${(article.abstract || '').replace(/"/g, '&quot;').substring(0, 500)}">
  <meta name="citation_keywords" content="${(article.keywords || []).join('; ')}">
  <meta name="citation_language" content="es">
  <meta name="description" content="${(article.abstract || '').replace(/"/g, '&quot;').substring(0, 160)}...">
  <meta name="keywords" content="${(article.keywords || []).join(', ')}">
  <title>${title} - Clásicos de la Ciencia</title>
  
  <!-- Fuentes: IM Fell para estilo clásico, Inter para modernidad, JetBrains Mono para código -->
  <link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+French+Canon:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=es6"></script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  
  <style>
/* ===== VARIABLES GLOBALES - PALETA ENVEJECIDA ===== */
:root {
  --oxford-blue: #001a36;           /* Azul más profundo */
  --british-green: #004225;
  --accent-burgundy: #8b1e3f;
  --old-gold: #c5a059;               /* Oro viejo para detalles */
  --cream-bg: #fcfaf2;                /* Crema hueso/pergamino */
  --bg-soft: #f2ede0;                 /* Fondo secundario como sombra de papel */
  --pure-white: var(--cream-bg);       /* El blanco desaparece */
  --text-main: #2a2a2a;                /* Texto no completamente negro */
  --text-light: #4a4a4a;
  --text-muted: #6b6b6b;
  --border-color: #dcd7c9;
  --code-bg: #1e1e1e;
  --code-text: #d4d4d4;
  --sidebar-width: 280px;
  --content-max-width: 800px;
  --nature-blue: #005a7d;
}

/* ===== RESET Y ESTILOS BASE CON TEXTURA ===== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  max-width: 100vw;
}

body {
  font-family: 'IM Fell English', serif;
  line-height: 1.7;
  color: var(--text-main);
  
  /* Fondo con textura de papel y viñeta */
  background-color: var(--cream-bg);
background-image:
  radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.03) 100%),
  linear-gradient(rgb(255, 255, 255), rgba(255, 255, 255, 0.69)),
  url("https://images.unsplash.com/photo-1615800098799-0ccb261b1f92");

  
  overflow-x: hidden;
  width: 100%;
  position: relative;
}

/* Suavizado de fuente para efecto tinta */
p, h1, h2, h3, h4, h5, h6, li, blockquote, .article-content {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2a2a2a;
}

/* ===== HEADER UNIFICADO CON FONDO ===== */
.sd-header {
  background: var(--cream-bg) !important;
  border-bottom: 1px solid var(--border-color);
  box-shadow: 0 2px 10px rgba(0,0,0,0.02);
  font-family: 'Inter', sans-serif;
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
}

.sd-header-top {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0.75rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.sd-journal-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #111111;
}

.sd-logo-img {
  height: 42px;
  width: auto;
  display: block;
  object-fit: contain;
}

.sd-journal-titles {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-color);
  padding-left: 15px;
}

.sd-journal-name {
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.2;
}

.sd-issn {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 2px;
}

/* Barra de búsqueda con fondo suave */
.sd-search-wrapper {
  flex: 1;
  max-width: 500px;
}

.sd-search-bar {
  display: flex;
  align-items: center;
  background: var(--bg-soft) !important;
  border-radius: 4px;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
}

.sd-search-bar input {
  border: none;
  background: transparent;
  width: 100%;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  outline: none;
  color: var(--text-main);
}

.sd-user-nav {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.sd-nav-link {
  text-decoration: none;
  color: var(--text-main);
  font-size: 0.85rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sd-mobile-controls {
  display: none;
}

/* ===== LAYOUT PRINCIPAL CON SIDEBARS ===== */
.main-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--sidebar-width);
  gap: 2rem;
  padding: 2rem;
}

/* ===== SIDEBAR IZQUIERDA - TABLA DE CONTENIDOS ===== */
.toc-sidebar {
  position: sticky;
  top: 100px;
  height: fit-content;
  font-family: 'Inter', sans-serif;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  padding-right: 1rem;
  border-right: 1px solid var(--border-color);
  scrollbar-width: thin;
}

.toc-sidebar::-webkit-scrollbar {
  width: 4px;
}

.toc-sidebar::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.toc-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--oxford-blue);
  margin-bottom: 1.5rem;
  font-family: 'Inter', sans-serif;
}

.toc-list {
  list-style: none;
}

.toc-item {
  margin: 0.5rem 0;
}

.toc-item a {
  display: block;
  color: var(--text-light);
  text-decoration: none;
  font-size: 0.85rem;
  line-height: 1.4;
  padding: 0.3rem 0.5rem;
  border-left: 2px solid transparent;
  transition: all 0.2s;
}

.toc-item a:hover {
  color: var(--oxford-blue);
  border-left-color: var(--accent-burgundy);
  background: var(--bg-soft) !important;
}

.toc-item a.active {
  color: var(--oxford-blue);
  border-left-color: var(--oxford-blue);
  font-weight: 500;
  background: linear-gradient(to right, var(--bg-soft), transparent);
}

.toc-level-3 a {
  padding-left: 1.5rem;
  font-size: 0.8rem;
}

.toc-level-4 a {
  padding-left: 2.5rem;
  font-size: 0.75rem;
}

.toc-special a {
  color: var(--accent-burgundy);
  font-weight: 500;
}

.toc-separator {
  margin: 1rem 0 0.5rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  padding-left: 0.5rem;
}

/* ===== CONTENIDO PRINCIPAL ===== */
.article-container {
  max-width: var(--content-max-width);
  width: 100%;
}

.seminal-title-container {
    text-align: center;
    padding: 100px 60px; /* Aumentamos el padding para dar "aire" de importancia */
    margin: 40px auto 60px auto;
    max-width: 900px;
    
    /* FONDO: Usamos el crema más claro para que "brille" sobre el fondo de la página */
    background-color: var(--cream-bg);
    background-image: 
        url("https://www.transparenttextures.com/patterns/natural-paper.png"), /* Textura física */
        radial-gradient(circle at center, rgba(255,255,255,0.8) 0%, transparent 100%);
    
    /* EL MARCO: Un borde doble sutil es la marca de la elegancia británica */
    border: 1px solid rgba(197, 160, 89, 0.3); /* Borde oro muy suave */
    outline: 1px solid rgba(197, 160, 89, 0.3);
    outline-offset: -15px; /* Crea un recuadro interno */
    
    /* SOMBRA: Una sombra muy ancha y muy suave para dar "peso visual" */
    box-shadow: 
        0 30px 70px rgba(0, 0, 0, 0.07),
        inset 0 0 50px rgba(255, 255, 255, 0.5);
    
    position: relative;
    overflow: visible;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.seminal-title-container:hover {
  transform: translateY(-5px);
}

/* Ornamentos en las esquinas */
.seminal-title-container::before,
.seminal-title-container::after {
  content: "❦";
  position: absolute;
  color: rgba(212, 175, 55, 0.4);
  font-size: 1.5rem;
}

.seminal-title-container::before {
  top: 20px;
  left: 20px;
}

.seminal-title-container::after {
  bottom: 20px;
  right: 20px;
  transform: rotate(180deg);
}

/* Sello de lacre */
.wax-seal {
  position: absolute;
  top: -20px;
  right: 30px;
  width: 70px;
  height: 70px;
  background: radial-gradient(circle, #b31b1b 0%, #8b0000 100%);
  border-radius: 50%;
  box-shadow: 
    3px 3px 5px rgba(0,0,0,0.3), 
    inset 2px 2px 4px rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transform: rotate(-10deg);
  border: 2px solid #7a0000;
}

.seal-text {
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Playfair Display', serif;
  font-weight: bold;
  font-size: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 5px;
  border-radius: 50%;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}

.collection-tag {
  font-family: 'IM Fell English', serif;
  font-variant: small-caps;
  letter-spacing: 0.3em;
  color: var(--accent-burgundy);
  font-size: 0.85rem;
  display: block;
  margin-bottom: 15px;
}
/* ===== TÍTULO ESTILO OXFORD UNIVERSITY PRESS ===== */
.main-classic-title {
  /* Baskervville: la elegancia británica definitiva */
  font-family: 'Baskervville', serif;
  
  /* Tamaño fluido: se adapta desde móvil (1.8rem) hasta escritorio grande (4.5rem) */
  font-size: clamp(1.8rem, 6vw, 4.5rem);
  
  /* Line-height ajustado para títulos largos (más compacto) */
  line-height: 1.05;
  
  /* Color Oxford Blue SÓLIDO (sin gradiente) */
  color: var(--oxford-blue);
  
  /* La itálica de Baskerville es pura elegancia académica */
  font-style: italic;
  font-weight: 400;
  
  /* Espaciado profesional */
  letter-spacing: -0.02em;
  word-spacing: 0.05em;
  
  /* Márgenes automáticos para centrado perfecto */
  margin: 20px auto;
  
  /* Máximo ancho controlado para evitar líneas ridículamente largas */
  max-width: 900px;
  
  /* Sombra tipo "letterpress" - parece hundido en el papel */
  text-shadow: 
    0px 1px 1px rgba(255, 255, 255, 0.8),
    0.5px 0.5px 2px rgba(0, 26, 54, 0.15);
  
  /* Ligaduras tipográficas clásicas */
  font-variant-ligatures: common-ligatures discretionary-ligatures;
  font-kerning: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  
  /* Control de saltos de línea para títulos larguísimos */
  overflow-wrap: break-word;
  word-wrap: break-word;
  hyphens: auto;
}

/* TÍTULOS EXTRA LARGOS - Casos especiales */
.main-classic-title--very-long {
  font-size: clamp(1.5rem, 5vw, 3.2rem);
  line-height: 1.2;
  max-width: 800px;
}

/* PRIMERA LÍNEA CON ÉNFASIS (efecto "capital" moderno) */
.main-classic-title::first-line {
  font-weight: 500;
  color: var(--oxford-blue);
  text-shadow: 
    0px 1px 1px rgba(255, 255, 255, 0.9),
    0.8px 0.8px 3px rgba(0, 26, 54, 0.2);
}

/* EFECTO DE TINTA REALISTA (sutil) */
.main-classic-title {
  position: relative;
}

.main-classic-title::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse at 30% 40%,
    rgba(0, 26, 54, 0.03) 0%,
    transparent 70%
  );
  pointer-events: none;
  mix-blend-mode: multiply;
}
/* ===== TÍTULO ORIGINAL (SUBTÍTULO) ===== */
.original-title {
  font-family: 'Baskervville', serif;
  font-size: clamp(1rem, 3vw, 1.3rem);
  color: var(--text-muted);
  font-style: italic;
  font-variant: small-caps;
  letter-spacing: 0.15em;
  margin-top: 0.5rem;
  opacity: 0.8;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  word-spacing: 0.1em;
  
  /* Línea decorativa sutil */
  border-top: 1px solid rgba(197, 160, 89, 0.2);
  padding-top: 1rem;
  display: inline-block;
}



.title-separator {
  width: 150px;
  height: 2px;
  background: var(--oxford-blue);
  margin: 20px auto;
  position: relative;
}

.title-separator::after {
  content: "✦";
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #f8f6f0; /* Ajustado al color interno de la caja */
  padding: 0 10px;
  color: var(--old-gold);
}

/* Reemplaza la regla actual de .archive-metadata con esto */
.archive-metadata {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0;
  font-family: 'Inter', sans-serif;
  text-transform: uppercase;
  font-size: 0.65rem;
  letter-spacing: 2px;
  background-color: var(--oxford-blue);
  color: var(--old-gold);
  border: none;
  padding: 25px 0;
  margin-top: 40px;
  margin-left: 0;  /* Cambiado de -40px a 0 */
  margin-right: 0; /* Cambiado de -40px a 0 */
  margin-bottom: 0; /* Cambiado de -80px a 0 */
  border-top: 2px solid var(--old-gold);
  width: 100%;      /* Asegurar que ocupe el ancho completo */
  box-sizing: border-box; /* Importante para que padding no desborde */
}
.meta-column {
  padding: 0 25px;
  border-right: 1px solid rgba(197, 160, 89, 0.3);
}

.meta-column:last-child {
  border-right: none;
}

.meta-label {
  display: block;
  color: rgba(197, 160, 89, 0.7);
  font-weight: 400;
  margin-bottom: 4px;
}

.meta-value {
  color: #ffffff;
  font-weight: 700;
  font-family: 'IM Fell English', serif;
  text-transform: none;
  font-style: italic;
  font-size: 0.9rem;
}
/* ===== CORRECCIONES ESPECÍFICAS PARA MÓVIL ===== */
@media (max-width: 600px) {
  /* Contenedor del título seminal */
  .seminal-title-container {
    padding: 30px 15px;
    margin-bottom: 30px;
  }
  
  /* Ocultar ornamentos en móvil para no saturar */
  .seminal-title-container::before,
  .seminal-title-container::after {
    display: none;
  }
  
  /* Sello de lacre más pequeño y mejor posicionado */
  .wax-seal {
    width: 50px;
    height: 50px;
    top: -15px;
    right: 15px;
  }
  
  /* Título principal más pequeño */
  .main-classic-title {
    font-size: 1.8rem;
    line-height: 1.2;
    margin: 10px 0;
  }
  
  /* Barra de metadatos en columna para móvil */
  .archive-metadata {
    flex-direction: column;
    align-items: stretch;
    padding: 15px 0;
    margin-top: 30px;
    margin-left: -15px;  /* Compensar el padding del contenedor */
    margin-right: -15px;
    width: calc(100% + 30px); /* Extenderse para cubrir el padding */
  }
  
  .meta-column {
    border-right: none;
    border-bottom: 1px solid rgba(197, 160, 89, 0.3);
    padding: 10px 15px;
    text-align: center;
  }
  
  .meta-column:last-child {
    border-bottom: none;
  }
  
  /* Autores en una línea que no desborde */
  .authors {
    font-size: 1rem;
    flex-wrap: wrap;
    justify-content: center;
    text-align: center;
  }
  
  /* Separador del título */
  .title-separator {
    width: 100px;
    margin: 15px auto;
  }
  
  /* Si hay título original, que no ocupe mucho espacio */
  .original-title {
    font-size: 1rem;
    padding: 0 10px;
    word-break: break-word;
  }
}
/* ===== AUTORES ===== */
.authors-section {
  margin: 1.5rem 0;
  font-family: 'Inter', sans-serif;
}

.authors {
  font-size: 1.1rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.author-link, .author-name {
  color: var(--oxford-blue);
  text-decoration: none;
  border-bottom: 1px dotted transparent;
  transition: border-color 0.2s;
}

.author-link:hover {
  border-bottom-color: var(--oxford-blue);
}

.author-info-icon {
  display: inline-block;
  margin-left: 4px;
  color: var(--accent-burgundy);
  cursor: pointer;
  font-weight: bold;
  font-size: 0.9rem;
}

.author-icons {
  display: inline-flex;
  gap: 0.3rem;
  margin-left: 0.3rem;
  vertical-align: middle;
}

.author-icon {
  display: inline-block;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.author-icon:hover {
  opacity: 1;
}

.author-separator {
  color: var(--text-light);
}

/* ===== COLABORADORES ===== */
.collaborators-section {
  margin: 1rem 0;
  padding: 1rem;
  background: var(--bg-soft);
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 0.9rem;
}

.collaborator-item {
  margin: 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.collaborator-name {
  font-weight: 600;
  color: var(--oxford-blue);
}

.collaborator-name a {
  color: var(--oxford-blue);
  text-decoration: none;
}

.collaborator-name a:hover {
  text-decoration: underline;
}

.collaborator-role {
  font-size: 0.8rem;
  color: var(--accent-burgundy);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* ===== ACCIONES ===== */
.action-bar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin: 2rem 0;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.btn-pdf {
  background: var(--oxford-blue);
  color: white !important;
  padding: 0.6rem 1.5rem;
  border-radius: 4px;
  text-decoration: none;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.btn-pdf:hover {
  background: #003a6b;
}

.oa-label {
  display: inline-flex;
  align-items: center;
  color: #F48120;
  font-weight: 500;
  font-size: 0.9rem;
  font-family: 'Inter', sans-serif;
  gap: 4px;
}
/* ===== LINKS DENTRO DE NOTAS AL PIE Y MARGINALES ===== */
.footnote-content a,
.margin-note-content a,
.sidenote a,
.margin-note-item a {
    color: var(--oxford-blue);
    text-decoration: none;
    border-bottom: 1px dotted var(--old-gold); /* Línea punteada dorada */
    font-weight: 500;
    transition: all 0.2s ease;
    position: relative;
    padding: 0 2px;
}

/* Efecto hover elegante */
.footnote-content a:hover,
.margin-note-content a:hover,
.sidenote a:hover,
.margin-note-item a:hover {
    color: var(--accent-burgundy);
    border-bottom: 1px solid var(--accent-burgundy);
    background: linear-gradient(to bottom, transparent 50%, rgba(139, 30, 63, 0.05) 50%);
}

/* Para links externos, añadir un icono sutil */
.footnote-content a[href^="http"]:not([href*="revistacienciasestudiantes.com"])::after,
.margin-note-content a[href^="http"]:not([href*="revistacienciasestudiantes.com"])::after {
    content: "↗";
    display: inline-block;
    margin-left: 3px;
    font-size: 0.7em;
    vertical-align: super;
    opacity: 0.7;
    transition: transform 0.2s;
}

.footnote-content a[href^="http"]:hover::after,
.margin-note-content a[href^="http"]:hover::after {
    transform: translate(1px, -1px);
    opacity: 1;
}

/* Para correos electrónicos */
.footnote-content a[href^="mailto:"]::before,
.margin-note-content a[href^="mailto:"]::before {
    content: "✉";
    display: inline-block;
    margin-right: 4px;
    font-size: 0.8em;
    opacity: 0.7;
}

/* Para PDFs y documentos */
.footnote-content a[href$=".pdf"]::after,
.margin-note-content a[href$=".pdf"]::after {
    content: "📄";
    display: inline-block;
    margin-left: 3px;
    font-size: 0.8em;
    opacity: 0.7;
}

/* Estilo especial para el link de retroceso (volver al texto) */
.footnote-back {
    display: inline-block;
    margin-left: 8px;
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.7rem;
    border-bottom: 1px dotted transparent;
    transition: all 0.2s;
}

.footnote-back:hover {
    color: var(--oxford-blue);
    border-bottom: 1px dotted var(--oxford-blue);
}

/* Para links que son referencias bibliográficas */
.footnote-content a[href*="doi.org"],
.margin-note-content a[href*="doi.org"] {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8em;
    color: var(--british-green);
    border-bottom: 1px dashed var(--british-green);
    word-break: break-all;
}

.footnote-content a[href*="doi.org"]:hover,
.margin-note-content a[href*="doi.org"]:hover {
    color: var(--oxford-blue);
    border-bottom: 1px solid var(--oxford-blue);
}

/* Decoración adicional para links importantes */
.footnote-content a.important-link,
.margin-note-content a.important-link {
    background: linear-gradient(120deg, transparent 0%, transparent 50%, rgba(197, 160, 89, 0.1) 50%);
    background-size: 230% 100%;
    background-position: 100% 0;
    border-bottom: 2px solid var(--old-gold);
    font-weight: 600;
    padding: 0 4px;
}

.footnote-content a.important-link:hover,
.margin-note-content a.important-link:hover {
    background-position: 0 0;
    color: var(--oxford-blue);
}
/* ===== ENLACES A REFERENCIAS BIBLIOGRÁFICAS EN NOTAS ===== */
.footnote-content a[href^="#ref-"],
.margin-note-content a[href^="#ref-"] {
    color: var(--british-green); /* Verde académico */
    text-decoration: none;
    border-bottom: 2px dotted var(--british-green);
    background: linear-gradient(to bottom, transparent 60%, rgba(0, 66, 37, 0.05) 60%);
    font-weight: 500;
    padding: 2px 4px 0 4px;
    border-radius: 3px 3px 0 0;
    transition: all 0.2s ease;
    position: relative;
}

/* Efecto hover con indicación de "ir a referencia" */
.footnote-content a[href^="#ref-"]:hover,
.margin-note-content a[href^="#ref-"]:hover {
    color: var(--oxford-blue);
    border-bottom-color: var(--oxford-blue);
    background: linear-gradient(to bottom, transparent 40%, rgba(0, 33, 71, 0.1) 40%);
    padding-left: 8px; /* Pequeño desplazamiento */
}

/* Añadir icono de libro/ referencia ANTES del enlace */
.footnote-content a[href^="#ref-"]::before,
.margin-note-content a[href^="#ref-"]::before {
    content: "📚";
    display: inline-block;
    margin-right: 4px;
    font-size: 0.8em;
    opacity: 0.6;
    transform: translateY(-1px);
    transition: transform 0.2s;
}

.footnote-content a[href^="#ref-"]:hover::before,
.margin-note-content a[href^="#ref-"]:hover::before {
    opacity: 1;
    transform: translateX(2px) translateY(-1px);
}

/* Para cuando la referencia ya ha sido visitada */
.footnote-content a[href^="#ref-"]:visited,
.margin-note-content a[href^="#ref-"]:visited {
    color: #5a4a3a; /* Color más apagado para visitado */
    border-bottom-color: #9a8a7a;
}

/* ===== INDICADOR DE "ESTÁS EN UNA REFERENCIA" ===== */
/* Cuando el usuario hace clic y llega a la referencia */
.reference-item:target {
    animation: referenceHighlight 2.5s ease;
    background: linear-gradient(145deg, transparent, rgba(197, 160, 89, 0.15));
    padding: 10px;
    margin: 5px 0;
    border-left: 4px solid var(--old-gold);
    border-radius: 0 8px 8px 0;
}

@keyframes referenceHighlight {
    0% { background-color: transparent; }
    30% { background-color: rgba(197, 160, 89, 0.2); }
    70% { background-color: rgba(197, 160, 89, 0.1); }
    100% { background-color: transparent; }
}

/* ===== TOOLTIP QUE MUESTRA EL TÍTULO DE LA REFERENCIA ===== */
.footnote-content a[href^="#ref-"]:hover::after,
.margin-note-content a[href^="#ref-"]:hover::after {
    content: attr(href);
    position: absolute;
    bottom: 100%;
    left: 0;
    background: var(--oxford-blue);
    color: var(--cream-bg);
    font-family: 'Inter', sans-serif;
    font-size: 0.7rem;
    padding: 6px 10px;
    border-radius: 4px;
    white-space: nowrap;
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    z-index: 1000;
    border: 1px solid var(--old-gold);
    box-shadow: 2px 2px 8px rgba(0,0,0,0.2);
    pointer-events: none;
    margin-bottom: 8px;
    
    /* Reemplazar el hash por un texto más amigable */
    content: "Ver referencia: " attr(href);
    white-space: normal;
    word-break: break-word;
    max-width: 280px;
    line-height: 1.4;
    padding: 8px 12px;
    text-transform: none;
    letter-spacing: normal;
}

/* Triángulo del tooltip */
.footnote-content a[href^="#ref-"]:hover::before,
.margin-note-content a[href^="#ref-"]:hover::before {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 15px;
    border-width: 6px;
    border-style: solid;
    border-color: var(--oxford-blue) transparent transparent transparent;
    z-index: 1001;
    pointer-events: none;
    margin-bottom: 2px;
}

/* ===== VERSIÓN MEJORADA PARA REFERENCIAS ESPECÍFICAS ===== */
/* Para cuando sabes que es una referencia a Euler */
.footnote-content a[href*="euler"],
.margin-note-content a[href*="euler"] {
    border-bottom-style: solid; /* Línea sólida para referencias clave */
    border-bottom-width: 2px;
    font-weight: 600;
}

.footnote-content a[href*="euler"]::before {
    content: "✧"; /* Símbolo especial para Euler */
    color: var(--old-gold);
}

/* ===== INDICADOR DE NÚMERO DE PÁGINA O SECCIÓN ===== */
.footnote-content a[href$="mech"]::after,
.margin-note-content a[href$="mech"]::after {
    content: " (Mec.)";
    font-size: 0.7em;
    color: var(--text-muted);
    font-style: italic;
    margin-left: 2px;
}

.footnote-content a[href$="intro"]::after,
.margin-note-content a[href$="intro"]::after {
    content: " (Introd.)";
    font-size: 0.7em;
    color: var(--text-muted);
    font-style: italic;
    margin-left: 2px;
}

/* ===== ESTILO PARA EL CONTENEDOR DE NOTAS AL PIE ===== */
.footnotes {
    margin-top: 3rem;
    padding: 1.5rem;
    background: var(--bg-soft);
    border-top: 2px solid var(--border-color);
    font-size: 0.9rem;
}

.footnotes p {
    margin: 0.8rem 0;
    padding-left: 2rem;
    text-indent: -1.5rem;
    line-height: 1.6;
}

.footnotes p:target {
    animation: footnoteHighlight 2s ease;
    background: rgba(197, 160, 89, 0.1);
    padding: 10px;
    margin: 5px -10px;
    border-radius: 4px;
}

@keyframes footnoteHighlight {
    0% { background-color: transparent; }
    50% { background-color: rgba(197, 160, 89, 0.2); }
    100% { background-color: transparent; }
}

/* ===== BOTÓN DE RETORNO DESDE LA REFERENCIA ===== */
.reference-item .return-link {
    display: inline-block;
    margin-left: 1rem;
    font-size: 0.7rem;
    color: var(--text-muted);
    text-decoration: none;
    border-bottom: 1px dotted var(--text-muted);
}

.reference-item .return-link:hover {
    color: var(--oxford-blue);
    border-bottom-color: var(--oxford-blue);
}

.reference-item .return-link::before {
    content: "↩ ";
    font-size: 0.8rem;
}

/* ===== ESTILO PARA ENLACES QUE APUNTAN A LA MISMA PÁGINA ===== */
.footnote-content a[href^="#"]:not([href^="#ref-"]):not([href^="#footnote"]),
.margin-note-content a[href^="#"]:not([href^="#ref-"]):not([href^="#footnote"]) {
    color: var(--accent-burgundy);
    border-bottom: 1px dashed var(--accent-burgundy);
}

.footnote-content a[href^="#"]:hover,
.margin-note-content a[href^="#"]:hover {
    border-bottom-style: solid;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 600px) {
    .footnote-content a[href^="#ref-"],
    .margin-note-content a[href^="#ref-"] {
        display: inline-block;
        padding: 4px 4px 4px 8px;
        background: rgba(0, 66, 37, 0.05);
        border-radius: 4px;
    }
    
    .footnote-content a[href^="#ref-"]:hover::after,
    .margin-note-content a[href^="#ref-"]:hover::after {
        position: fixed;
        bottom: 10px;
        left: 10px;
        right: 10px;
        max-width: none;
        width: auto;
        white-space: normal;
        font-size: 0.8rem;
    }
}
/* ===== INDICADORES DE NOTAS MARGINALES ===== */
.margin-note-indicator-wrapper {
  display: inline;
}
.margin-note-badge {
    display: inline-block;
    background-color: transparent;
    color: var(--accent-burgundy);
    border: 1px solid var(--accent-burgundy);
    
    /* Forma de etiqueta clásica, no píldora */
    border-radius: 2px; 
    
    font-size: 0.7rem;
    font-weight: 500;
    padding: 1px 5px;
    margin: 0 2px;
    vertical-align: super;
    font-family: 'IM Fell English', serif;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
}

.margin-note-badge:hover {
    background-color: var(--oxford-blue);
    color: white;
    border-color: var(--oxford-blue);
    transform: translateY(-2px);
}

/* Si quieres que el marcador sea una "N" (de Nota) o un símbolo */
.margin-note-badge::before {
    content: "§ "; /* Símbolo de sección, muy académico */
    font-size: 0.6rem;
    opacity: 0.7;
}
/* Efecto de resaltado cuando se navega desde la sidebar */
@keyframes highlightPulse {
  0% { background-color: transparent; }
  50% { background-color: #fff3cd; }
  100% { background-color: transparent; }
}

.margin-note-highlight {
  animation: highlightPulse 2s ease;
}

/* ===== ABSTRACT ===== */
.abstract-section {
  margin: 2rem 0;
}

h2 {
  font-family: 'IM Fell French Canon', serif;
  font-size: 1.8rem;
  font-weight: normal;
  color: var(--oxford-blue);
  margin: 2rem 0 1.5rem 0;
  scroll-margin-top: 100px;
}

.abstract-text {
  font-size: 1.1rem;
  text-align: justify;
  line-height: 1.8;
}

.keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 1rem;
}

.keyword-tag {
  font-size: 0.8rem;
  background: var(--bg-soft);
  padding: 4px 12px;
  border-radius: 20px;
  color: var(--oxford-blue);
  font-family: 'Inter', sans-serif;
}

/* ===== MENÚ HAMBURGUESA PARA MÓVIL ===== */
.sd-mobile-controls {
  display: none;
  align-items: center;
  gap: 0.5rem;
}

.sd-mobile-search-btn {
  display: none;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--text-main);
}

.sd-mobile-search-btn svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.sd-mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--text-main);
}

.sd-mobile-menu-btn svg {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

/* Overlay para el menú móvil */
.sd-mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.sd-mobile-overlay.active {
  display: block;
  opacity: 1;
}

/* Menú lateral móvil con fondo unificado */
.sd-mobile-menu {
  position: fixed;
  top: 0;
  right: -100%;
  width: 85%;
  max-width: 350px;
  height: 100vh;
  background: var(--cream-bg) !important;
  z-index: 1000;
  overflow-y: auto;
  transition: right 0.3s ease;
  box-shadow: -2px 0 10px rgba(0,0,0,0.1);
  font-family: 'Inter', sans-serif;
  display: flex;
  flex-direction: column;
}

.sd-mobile-menu.active {
  right: 0;
}

/* Header del menú móvil */
.sd-mobile-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.sd-mobile-menu-title {
  font-weight: 600;
  color: var(--oxford-blue);
  font-size: 0.9rem;
}

.sd-mobile-close-btn {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--text-main);
}

.sd-mobile-close-btn svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

/* Búsqueda en menú móvil */
.sd-mobile-search {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.sd-mobile-search-bar {
  display: flex;
  align-items: center;
  background: var(--bg-soft) !important;
  border-radius: 4px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
}

.sd-mobile-search-bar:focus-within {
  border-color: var(--oxford-blue);
  background: #fff;
}

.sd-mobile-search-bar input {
  border: none;
  background: transparent;
  width: 100%;
  font-family: 'Inter', sans-serif;
  font-size: 0.9rem;
  outline: none;
  margin-left: 8px;
}

/* Navegación en menú móvil */
.sd-mobile-nav {
  flex: 1;
  padding: 1rem 0;
}

.sd-mobile-nav-section {
  margin-bottom: 1.5rem;
}

.sd-mobile-nav-section-title {
  padding: 0.5rem 1rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  background: var(--bg-soft) !important;
}

.sd-mobile-nav-items {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sd-mobile-nav-item {
  border-bottom: 1px solid var(--border-color);
}

.sd-mobile-nav-item:last-child {
  border-bottom: none;
}

.sd-mobile-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 1rem;
  text-decoration: none;
  color: var(--text-main);
  font-size: 0.95rem;
  transition: background 0.2s;
}

.sd-mobile-nav-link:hover {
  background: var(--bg-soft) !important;
}

.sd-mobile-nav-link svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
  color: var(--text-muted);
}

.sd-mobile-nav-badge {
  margin-left: auto;
  font-size: 0.7rem;
  color: var(--text-muted);
}

/* Footer del menú móvil */
.sd-mobile-menu-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  font-size: 0.8rem;
  color: var(--text-muted);
  text-align: center;
}

/* ===== CONTENIDO DEL ARTÍCULO ===== */
.article-content {
  font-size: 1.1rem;
  line-height: 1.8;
  text-align: justify;
}

.article-content p {
  margin-bottom: 1.5rem;
}

.article-content h2 {
  font-family: 'IM Fell French Canon', serif;
  font-size: 1.8rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.5rem;
}

.article-content h3 {
  font-family: 'IM Fell English', serif;
  font-size: 1.4rem;
  font-weight: 600;
  margin: 1.8rem 0 1rem;
}

.article-content h4 {
  font-family: 'IM Fell English', serif;
  font-size: 1.2rem;
  font-style: italic;
}

/* ===== BLOQUES DE CÓDIGO CON BORDE DORADO ===== */
.code-block-wrapper {
  margin: 2.5rem 0;
  border-radius: 12px;
  background: #1e1e1e;
  box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  font-family: 'JetBrains Mono', monospace;
  border: 1px solid var(--old-gold);
}

.code-header {
  background: #2d2d2d;
  padding: 0.6rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #3c3c3c;
  color: #cccccc;
  font-family: 'Inter', sans-serif;
}

.code-language {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #9cdcfe;
}

.code-copy-btn {
  background: #3c3c3c;
  border: 1px solid #555555;
  border-radius: 4px;
  padding: 0.3rem 0.8rem;
  font-size: 0.7rem;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #cccccc;
  transition: all 0.2s ease;
}

.code-copy-btn:hover {
  background: #4ec9b0;
  border-color: #4ec9b0;
  color: #1e1e1e;
}

.code-block-container {
  display: flex;
  background: #1e1e1e;
  position: relative;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-width: 100vw;
  width: 100%;
}

.code-line-numbers {
  display: flex;
  flex-direction: column;
  padding: 1.2rem 0 1.2rem 1rem;
  text-align: right;
  background: #1e1e1e;
  color: #6d8a9e;
  font-size: 0.85rem;
  line-height: 1.6;
  font-family: 'JetBrains Mono', monospace;
  user-select: none;
  border-right: 1px solid #3c3c3c;
  min-width: 45px;
}

.code-line-number {
  display: block;
  padding-right: 0.8rem;
  color: #6d8a9e;
  font-size: 0.8rem;
}

.code-block {
  flex: 1;
  margin: 0;
  padding: 1.2rem 0 1.2rem 1.5rem;
  background: transparent;
  color: #d4d4d4;
  line-height: 1.6;
  font-size: 0.85rem;
  overflow-x: auto;
  font-family: 'JetBrains Mono', monospace;
  tab-size: 2;
  white-space: pre;
  word-break: normal;
}

/* ===== TABLAS ESTILO ACADÉMICO ===== */
.table-download-wrapper {
  margin: 2.5rem 0;
  background: transparent;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.5rem 0;
  background: transparent;
  border-bottom: 1.5px solid var(--text-main);
  font-family: 'Inter', sans-serif;
}

.table-label {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-main);
}

.table-download-buttons {
  display: flex;
  gap: 1rem;
}

.table-download-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.2rem 0;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-variant: small-caps;
  text-decoration: none;
  transition: color 0.2s ease;
  border-bottom: 1px solid transparent;
}

.table-download-btn:hover {
  color: var(--oxford-blue);
  border-bottom: 1px solid var(--oxford-blue);
}

.table-wrapper {
  overflow-x: auto;
  padding: 1rem 0;
}

.article-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Inter', sans-serif;
  font-size: 0.9rem;
  color: var(--text-main);
  min-width: 100%;
  border-top: 2px solid var(--text-main);
  border-bottom: 2px solid var(--text-main);
}

.article-table th {
  border-bottom: 1.5px solid var(--text-main);
  background: transparent;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 15px;
  color: var(--text-main);
  text-align: left;
}

.article-table td {
  padding: 12px 15px;
  border: none;
  border-bottom: 1px solid #eee;
}

.article-table tr:last-child td {
  border-bottom: none;
}

.article-table tr:hover {
  background-color: var(--bg-soft);
}

/* ===== IMÁGENES ===== */
.image-link {
  display: inline-block;
  position: relative;
  cursor: zoom-in;
  transition: filter 0.3s ease;
  line-height: 0;
}

.image-link:hover {
  filter: brightness(0.95);
}

.image-link::after {
  content: "⤢";
  position: absolute;
  bottom: 12px;
  right: 12px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  width: 28px;
  height: 28px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  opacity: 0;
  transition: opacity 0.2s ease;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.image-link:hover::after {
  opacity: 1;
}

.image-figure {
  margin: 2rem 0;
  text-align: center;
}

.image-figure.float-left {
  float: left;
  margin: 0 1.5rem 1rem 0;
  max-width: 50%;
}

.image-figure.float-right {
  float: right;
  margin: 0 0 1rem 1.5rem;
  max-width: 50%;
}

.image-figure figcaption {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  font-style: italic;
}

.article-image {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  display: block;
}
/* ===== NUEVAS REGLAS PARA LA INFO MÓVIL ===== */
.mobile-info {
  display: none; /* Oculto por defecto en escritorio */
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid var(--border-color);
}

/* Asegurar que los elementos internos de las pestañas se vean bien */
.mobile-info .info-tabs {
  background: var(--cream-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.mobile-info .tab-buttons {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-soft);
}

.mobile-info .tab-button {
  flex: 1;
  padding: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-light);
  border-bottom: 2px solid transparent;
}

.mobile-info .tab-button:hover {
  color: var(--oxford-blue);
  background: white;
}

.mobile-info .tab-button.active {
  color: var(--oxford-blue);
  border-bottom-color: var(--oxford-blue);
  background: white;
}

.mobile-info .tab-panel {
  display: none;
  padding: 1.5rem;
}

.mobile-info .tab-panel.active {
  display: block;
}

/* Estilos para keywords y metadata dentro de la info móvil */
.mobile-info .keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mobile-info .keyword-tag {
  font-size: 0.7rem;
  background: var(--bg-soft);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  color: var(--text-light);
}

.mobile-info .metadata-item {
  font-size: 0.85rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
}

.mobile-info .metadata-item:last-child {
  border-bottom: none;
}

.mobile-info .metadata-label {
  color: var(--text-muted);
  font-weight: 500;
}

.mobile-info .metadata-value {
  font-weight: 400;
  text-align: right;
}

.mobile-info .margin-notes-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mobile-info .margin-note-item {
  margin-bottom: 1.2rem;
  padding: 0.75rem;
  background: var(--bg-soft);
  border-left: 3px solid var(--accent-burgundy);
  font-size: 0.85rem;
  border-radius: 0 4px 4px 0;
}

.mobile-info .citation-box {
  background: transparent;
  padding: 0;
  border: none;
}
.mobile-info .bibtex-download-btn {
  margin-top: 1rem;
  display: inline-flex;
}

/* ===== MODIFICAR LA MEDIA QUERY EXISTENTE ===== */
/* Busca tu @media (max-width: 1100px) y ajústalo así: */
@media (max-width: 1100px) {
  .main-wrapper {
    grid-template-columns: 1fr; /* Una sola columna */
    gap: 2rem;
  }
  .toc-sidebar, .right-sidebar {
    display: none; /* OCULTAR SIDEBARS EN MÓVIL/TABLET */
  }
  .mobile-info {
    display: block; /* MOSTRAR LA INFO MÓVIL */
  }
}
/* ===== ECUACIONES CON ESTILO MANUSCRITO ANTIGUO ===== */
.MathJax, .MathJax_Display, .MathJax_CHTML, .math-container {
  margin: 2rem 0 !important;
  padding: 0.5rem 0 !important;
  
  /* SIN FONDO, SIN BORDES - se fusiona con el texto */
  background: transparent !important;
  border: none !important;
  
  /* Tinta antigua - textura y peso */
  color: #2a2a2a !important;
  text-shadow: 
    0.5px 0.5px 0 rgba(0, 0, 0, 0.1),
    1px 1px 1px rgba(0, 0, 0, 0.02);
  
  /* Pequeña irregularidad en el peso */
  font-weight: 400;
  
  /* Transiciones suaves */
  transition: all 0.2s ease;
  
  /* Para ecuaciones largas, scroll pero con estilo */
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

/* Efecto de "tinta fresca" en hover - como si acabaran de escribirla */
.MathJax:hover, .math-container:hover {
  text-shadow: 
    0.8px 0.8px 0 rgba(139, 30, 63, 0.15),
    2px 2px 3px rgba(0, 0, 0, 0.05);
}

/* Variables matemáticas con estilo manuscrito */
.MathJax .mjx-char, .MathJax_CHTML .mjx-char {
  font-family: 'IM Fell English', 'Garamond', serif !important;
  filter: none; /* Sin efectos digitales */
  transition: color 0.2s ease;
}

/* Efecto de "anotación manuscrita" en hover para variables importantes */
.MathJax .mjx-char:hover {
  color: var(--accent-burgundy) !important;
  cursor: help;
  position: relative;
}

/* Tooltip estilo manuscrito para variables */
.MathJax .mjx-char[data-mjx-variable]:hover::after {
  content: attr(data-mjx-variable);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--cream-bg);
  border: 1px solid var(--old-gold);
  padding: 4px 8px;
  font-family: 'IM Fell English', serif;
  font-size: 0.7rem;
  white-space: nowrap;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.1);
  z-index: 100;
  pointer-events: none;
  color: var(--oxford-blue);
  font-style: italic;
}

/* Scrollbar con estilo antiguo para ecuaciones largas */
.MathJax_Display::-webkit-scrollbar,
.math-container::-webkit-scrollbar {
  height: 4px;
  background: transparent;
}

.MathJax_Display::-webkit-scrollbar-track,
.math-container::-webkit-scrollbar-track {
  background: rgba(197, 160, 89, 0.1);
  border-radius: 2px;
}

.MathJax_Display::-webkit-scrollbar-thumb,
.math-container::-webkit-scrollbar-thumb {
  background: var(--old-gold);
  border-radius: 2px;
  opacity: 0.5;
}

.MathJax_Display::-webkit-scrollbar-thumb:hover,
.math-container::-webkit-scrollbar-thumb:hover {
  background: var(--accent-burgundy);
}

/* ===== ECUACIONES DESTACADAS (ESPECÍMENES) ===== */
/* Solo para las ecuaciones más importantes */
.equation-specimen {
  margin: 3rem auto;
  max-width: 90%;
  position: relative;
  
  /* Marco invisible con sutiles ornamentos */
  background: linear-gradient(145deg, transparent 30%, rgba(197, 160, 89, 0.02) 70%);
  padding: 2rem 1rem;
  
  /* Líneas decorativas muy sutiles */
  border-top: 1px solid rgba(197, 160, 89, 0.15);
  border-bottom: 1px solid rgba(197, 160, 89, 0.15);
  
  /* Sombra interna que imita hendidura del papel */
  box-shadow: inset 0 0 20px rgba(0,0,0,0.02);
}

/* Etiqueta de "Teorema" o "Proposición" */
.equation-label {
  font-family: 'IM Fell English', serif;
  font-variant: small-caps;
  color: var(--accent-burgundy);
  font-size: 0.75rem;
  letter-spacing: 3px;
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--cream-bg);
  padding: 0 1rem;
  text-transform: uppercase;
  white-space: nowrap;
}

/* Número de ecuación estilo antiguo */
.equation-number {
  font-family: 'IM Fell English', serif;
  font-style: italic;
  font-size: 0.7rem;
  color: var(--text-muted);
  position: absolute;
  bottom: -8px;
  right: 20px;
  background: var(--cream-bg);
  padding: 0 0.5rem;
}

/* ===== ANOTACIONES AL MARGEN PARA ECUACIONES ===== */
.math-annotation {
  position: absolute;
  right: calc(100% + 20px);
  top: 50%;
  transform: translateY(-50%);
  width: 180px;
  font-family: 'IM Fell English', serif;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--text-light);
  text-align: right;
  border-right: 1px solid var(--old-gold);
  padding-right: 12px;
  opacity: 0.7;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.math-annotation.left {
  left: calc(100% + 20px);
  right: auto;
  text-align: left;
  border-right: none;
  border-left: 1px solid var(--old-gold);
  padding-right: 0;
  padding-left: 12px;
}

.math-annotation:hover {
  opacity: 1;
}

/* Para anotaciones dentro del texto de la ecuación */
.math-note {
  display: inline-block;
  font-size: 0.7rem;
  color: var(--text-muted);
  font-style: italic;
  margin-left: 0.5rem;
  vertical-align: middle;
  border-left: 1px solid var(--old-gold);
  padding-left: 0.5rem;
  line-height: 1.2;
}

/* ===== NÚMEROS CON ESTILO ANTIGUO (OLD STYLE) ===== */
.oldstyle-nums {
  font-variant-numeric: oldstyle-nums;
  -moz-font-feature-settings: "onum";
  -webkit-font-feature-settings: "onum";
  font-feature-settings: "onum";
}

/* Aplicar a ecuaciones y números */
.MathJax .mjx-num, 
.equation-number,
.page-number {
  font-variant-numeric: oldstyle-nums;
  -moz-font-feature-settings: "onum";
  -webkit-font-feature-settings: "onum";
  font-feature-settings: "onum";
}

/* ===== FRACCIONES CON ESTILO MANUSCRITO ===== */
.MathJax .mjx-frac {
  font-size: 0.9em; /* Fracciones ligeramente más pequeñas como en manuscritos */
}

.MathJax .mjx-frac:hover {
  background: rgba(197, 160, 89, 0.05);
  border-radius: 2px;
}

/* ===== SÍMBOLOS ESPECIALES CON CARÁCTER ===== */
/* Integrales con cola más larga como en manuscritos antiguos */
.MathJax .mjx-mo[data-mjx-name="int"] {
  transform: scale(1.2, 1.1);
  display: inline-block;
}

/* Símbolos de suma y producto con más peso */
.MathJax .mjx-mo[data-mjx-name="sum"],
.MathJax .mjx-mo[data-mjx-name="prod"] {
  font-weight: 600;
  transform: scale(1.1);
}

/* ===== RESPONSIVE PARA ECUACIONES ===== */
@media (max-width: 1100px) {
  .math-annotation {
    position: static;
    width: auto;
    margin: 0.5rem 0 0.5rem 1rem;
    text-align: left;
    border-right: none;
    border-left: 2px solid var(--old-gold);
    padding-left: 0.75rem;
    opacity: 1;
    transform: none;
  }
  
  .equation-specimen {
    max-width: 100%;
    padding: 1.5rem 0.5rem;
  }
  
  .equation-label {
    font-size: 0.65rem;
    white-space: normal;
    text-align: center;
    width: 100%;
    padding: 0 0.5rem;
  }
}

@media (max-width: 600px) {
  .MathJax, .MathJax_Display {
    font-size: 0.9rem;
  }
  
  .equation-specimen {
    padding: 1rem 0.25rem;
  }
  
  .math-annotation {
    margin-left: 0.5rem;
    padding-left: 0.5rem;
    font-size: 0.7rem;
  }
}

/* ===== LISTAS ===== */
.article-content ul, 
.article-content ol {
  margin: 1.5rem 0 1.5rem 2rem;
  padding-left: 0;
}

.article-content li {
  margin-bottom: 0.5rem;
}

.article-content ul ul {
  list-style-type: circle;
}

.article-content ul ul ul {
  list-style-type: square;
}

.article-content ol ol {
  list-style-type: lower-alpha;
}

.article-content ol ol ol {
  list-style-type: lower-roman;
}

/* ===== CITAS ===== */
blockquote {
  margin: 3rem 4rem;
  padding: 0 1.5rem;
  border-left: 3px solid var(--accent-burgundy);
  font-style: italic;
  font-size: 1.2rem;
  color: var(--text-light);
  position: relative;
}

blockquote::before {
  content: '"';
  position: absolute;
  top: -10px;
  left: -10px;
  font-size: 4rem;
  color: var(--bg-soft);
  font-family: 'IM Fell French Canon', serif;
  z-index: -1;
}

blockquote cite {
  display: block;
  margin-top: 1rem;
  font-size: 0.9rem;
  font-style: normal;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--oxford-blue);
  letter-spacing: 1px;
}

/* ===== NOTAS MARGINALES ===== */
.margin-toggle {
  display: inline-block;
  color: var(--accent-burgundy);
  cursor: pointer;
  font-size: 0.9rem;
  margin: 0 4px;
  vertical-align: middle;
}

.margin-note-indicator {
  font-size: 0.7rem;
  vertical-align: super;
  margin-left: 2px;
}

.sidenote {
  float: right;
  clear: right;
  margin-right: -250px;
  width: 220px;
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text-light);
  background: var(--bg-soft);
  padding: 0.8rem;
  border-left: 2px solid var(--accent-burgundy);
  border-radius: 4px;
  font-style: italic;
  position: relative;
}

.margin-toggle-checkbox {
  display: none;
}

.margin-toggle-checkbox:checked + .sidenote {
  display: block;
}

/* ===== NOTAS AL PIE ===== */
/* El marcador en el texto */
.footnote-link {
    text-decoration: none;
    color: var(--accent-burgundy);
    font-family: 'IM Fell English', serif;
    font-weight: bold;
    font-size: 0.9em;
    padding: 0 2px;
    transition: all 0.2s;
}

.footnote-link:hover {
    background-color: rgba(139, 30, 63, 0.1);
    border-bottom: 1px solid var(--accent-burgundy);
}

/* El contenido de la nota (Pop-up) */
.footnote-content {
    display: none;
    position: fixed;
    bottom: 30px;
    right: 30px;
    max-width: 350px;
    background: var(--cream-bg); /* Fondo pergamino */
    padding: 1.5rem;
    
    /* Estética de documento oficial */
    border: 1px solid var(--old-gold);
    border-left: 4px solid var(--oxford-blue); /* Acento de autoridad */
    
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    z-index: 1000;
    font-family: 'Libre Baskerville', serif;
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--text-main);
    animation: noteFadeIn 0.3s ease;
}

@keyframes noteFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Indicador de "Nota de la Edición" */
.footnote-content::before {
    content: "Nota de la Edición";
    display: block;
    font-family: 'Inter', sans-serif;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-size: 0.65rem;
    color: var(--old-gold);
    margin-bottom: 10px;
    border-bottom: 1px solid rgba(197, 160, 89, 0.2);
    padding-bottom: 5px;
}
/* ===== REFERENCIAS ===== */
.references-list {
  margin-top: 2rem;
  font-size: 0.95rem;
}

.reference-item {
  margin-bottom: 1.2rem;
  padding-left: 2rem;
  text-indent: -2rem;
  line-height: 1.6;
  word-wrap: break-word;
  scroll-margin-top: 100px;
}

.reference-item em {
  font-style: italic;
}

.reference-item a {
  color: var(--oxford-blue);
  text-decoration: none;
  word-break: break-all;
  border-bottom: 1px dotted var(--border-color);
}

.reference-item a:hover {
  border-bottom: 1px solid var(--oxford-blue);
}

/* ===== APÉNDICE ===== */
.appendix-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid var(--border-color);
}

/* ===== NOTA EDITORIAL ===== */
.editorial-note {
  margin: 2rem 0;
  padding: 1.5rem;
  background: var(--bg-soft);
  border-left: 4px solid var(--accent-burgundy);
  font-style: italic;
  font-family: 'IM Fell English', serif;
}

.editorial-note h3 {
  font-family: 'Inter', sans-serif;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--accent-burgundy);
  margin-bottom: 0.5rem;
}

/* ===== MODAL DE AUTORES (ESTILO FICHA DE ARCHIVO) ===== */
.author-modal {
    display: none;
    position: fixed;
    z-index: 2000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 26, 54, 0.4); /* Azul Oxford muy transparente */
    backdrop-filter: blur(8px) sepia(20%); /* Desenfoque con tinte antiguo */
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.author-modal-content {
    background: var(--cream-bg);
    background-image: url("https://www.transparenttextures.com/patterns/natural-paper.png");
    margin: 8% auto;
    padding: 3rem;
    position: relative;
    width: 90%;
    max-width: 600px;
    
    /* Marco Doble Clásico */
    border: 1px solid var(--old-gold);
    outline: 3px double var(--old-gold);
    outline-offset: -12px;
    
    /* Sombra de "Documento sobre la mesa" */
    box-shadow: 
        0 30px 60px rgba(0, 0, 0, 0.4),
        inset 0 0 100px rgba(197, 160, 89, 0.05);
    
    animation: modalSlideUp 0.5s ease-out;
}

@keyframes modalSlideUp {
    from { opacity: 0; transform: translateY(40px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Esquinas Decorativas (Fleurons) */
.author-modal-content::before {
    content: "❧";
    position: absolute;
    top: 15px;
    left: 15px;
    color: var(--old-gold);
    font-size: 1.2rem;
    opacity: 0.6;
}

/* Botón Cerrar: Más discreto y tipográfico */
.author-modal-close {
    position: absolute;
    top: 20px;
    right: 25px;
    font-family: 'Inter', sans-serif;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--text-muted);
    cursor: pointer;
    border-bottom: 1px solid transparent;
    transition: all 0.3s;
}

.author-modal-close:hover {
    color: var(--accent-burgundy);
    border-bottom-color: var(--accent-burgundy);
}

/* Tipografía del Autor */
.author-modal-content h3 {
    font-family: 'IM Fell French Canon', serif;
    font-size: 2.5rem;
    font-style: italic;
    color: var(--oxford-blue);
    text-align: center;
    margin-bottom: 0.5rem;
}

.author-dates {
    font-family: 'IM Fell English', serif;
    text-align: center;
    color: var(--accent-burgundy);
    font-size: 1.1rem;
    font-style: italic;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(197, 160, 89, 0.3);
    position: relative;
}

/* El detalle del rombo en la línea divisoria */
.author-dates::after {
    content: "✦";
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--cream-bg);
    padding: 0 10px;
    font-size: 0.7rem;
    color: var(--old-gold);
}

/* Cuerpo de la Biografía */
.author-bio {
    font-family: 'Libre Baskerville', serif; /* Serif de lectura académica */
    line-height: 1.8;
    font-size: 0.95rem;
    color: #333;
    text-align: justify;
    padding: 0 10px;
    max-height: 350px;
    overflow-y: auto;
}

/* Scrollbar con estilo de "tinta" */
.author-bio::-webkit-scrollbar { width: 3px; }
.author-bio::-webkit-scrollbar-track { background: var(--bg-soft); }
.author-bio::-webkit-scrollbar-thumb { background: var(--old-gold); }

/* Links internos del modal */
.author-modal-content a {
    color: var(--oxford-blue);
    text-decoration: none;
    font-style: italic;
    box-shadow: inset 0 -1px 0 rgba(0, 26, 54, 0.2);
    transition: all 0.2s;
}

.author-modal-content a:hover {
    box-shadow: inset 0 -1px 0 var(--oxford-blue);
    color: var(--accent-burgundy);
}
/* ===== SIDEBAR DERECHA CON PESTAÑAS ===== */
.right-sidebar {
  position: sticky;
  top: 100px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  font-family: 'Inter', sans-serif;
  padding-left: 1rem;
  border-left: 1px solid var(--border-color);
  scrollbar-width: thin;
}

.right-sidebar::-webkit-scrollbar {
  width: 4px;
}

.right-sidebar::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}
/* ===== LICENCIA (ESTILO SEAL) ===== */
.license-section {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 2px dashed var(--border-color); /* Una línea discontinua más estilizada */
    font-family: 'Inter', sans-serif;
    text-align: center; /* Centrar el contenido */
}

.license-section p {
    background: var(--bg-soft); /* Fondo suave como papel viejo */
    display: inline-block; /* Para que el fondo se ajuste al contenido */
    padding: 0.8rem 2rem;
    border-radius: 40px; /* Bordes redondeados tipo sello */
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    font-size: 0.85rem;
    color: var(--text-light);
}

.license-section a {
    color: var(--oxford-blue);
    text-decoration: none;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 8px; /* Espacio entre el logo CC y el texto */
    transition: color 0.2s ease;
    border-bottom: 1px dotted transparent;
}

.license-section a:hover {
    color: var(--accent-burgundy);
    border-bottom-color: var(--accent-burgundy);
}

/* Asegurar que el logo SVG de CC se vea bien */
.license-section a img,
.license-section a svg {
    height: 1.2em;
    width: auto;
    vertical-align: middle;
    display: inline-block;
}
.info-tabs {
  background: var(--cream-bg) !important;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.tab-buttons {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-soft) !important;
}

.tab-button {
  flex: 1;
  padding: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-light);
  border-bottom: 2px solid transparent;
}

.tab-button:hover {
  color: var(--oxford-blue);
  background: white !important;
}

.tab-button.active {
  color: var(--oxford-blue);
  border-bottom-color: var(--oxford-blue);
  background: white !important;
}

.tab-panel {
  display: none;
  padding: 1.5rem;
}

.tab-panel.active {
  display: block;
}

.info-card h4 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  margin-bottom: 1rem;
  font-weight: 600;
}

.citation-box {
  background: transparent;
}

.citation-item {
  position: relative;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.8rem;
}

.citation-item:last-child {
  border-bottom: none;
}

.copy-btn {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: white;
  border: 1px solid var(--border-color);
  padding: 2px 8px;
  font-size: 0.65rem;
  cursor: pointer;
  border-radius: 4px;
}

.copy-btn:hover {
  background: var(--oxford-blue);
  border-color: var(--oxford-blue);
  color: white;
}

/* Botón de descarga BibTeX */
.bibtex-download-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.3rem 0.8rem;
  background: var(--oxford-blue);
  color: white !important;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s;
  border: none;
  cursor: pointer;
  margin-left: 0.5rem;
}

.bibtex-download-btn:hover {
  background: #003a6b;
  text-decoration: none;
}

.bibtex-download-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

/* ===== NOTAS MARGINALES EN SIDEBAR ===== */
.margin-notes-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.margin-note-item {
  margin-bottom: 1.2rem;
  padding: 0.75rem;
  background: var(--bg-soft);
  border-left: 3px solid var(--accent-burgundy);
  font-size: 0.85rem;
  border-radius: 0 4px 4px 0;
}

.margin-note-number {
  display: inline-block;
  font-weight: 600;
  color: var(--accent-burgundy);
  margin-right: 0.5rem;
  font-size: 0.7rem;
}

.margin-note-content {
  display: inline;
}

.margin-note-backlink {
  display: block;
  text-align: right;
  margin-top: 0.5rem;
  font-size: 0.7rem;
}

.margin-note-backlink a {
  color: var(--oxford-blue);
  text-decoration: none;
}

.margin-note-backlink a:hover {
  text-decoration: underline;
}
/* ===== PREVISUALIZACIÓN PDF ===== */

.pdf-preview-section {
  margin: 3rem 0;
  scroll-margin-top: 100px;
}

.pdf-preview-container {
  width: 100%;
  height: 700px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  margin: 1.5rem 0;
  background: var(--bg-soft);
}

.pdf-embed {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.pdf-actions {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
  flex-wrap: wrap;
}


/* ===== BOTONES ===== */

.btn-pdf {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;

  font-family: 'Inter', sans-serif;
  font-weight: 500;
  font-size: 0.9rem;

  text-decoration: none;
  cursor: pointer;

  transition: all 0.2s ease;
}


/* BOTÓN PRINCIPAL: ABRIR PDF */

.btn-pdf.btn-open {
  background: var(--oxford-blue);
  color: white;
  border: none;
}

.btn-pdf.btn-open:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}


/* BOTÓN DESCARGAR — OUTLINE AZUL */

.btn-pdf.btn-download {
  background: transparent;
  color: var(--oxford-blue);
  border: 1px solid var(--oxford-blue);
}

.btn-pdf.btn-download:hover {
  background: var(--oxford-blue);
  color: white;
  transform: translateY(-1px);
}

/* ===== RESPONSIVE ===== */

@media (max-width: 1100px) {
  .pdf-preview-container {
    height: 500px;
  }
}

@media (max-width: 600px) {
  .pdf-preview-container {
    height: 400px;
  }

  .pdf-actions {
    flex-direction: column;
  }

  .btn-pdf {
    justify-content: center;
  }
}
/* ===== FOOTER CON AZUL OXFORD ===== */
.footer {
  background: var(--oxford-blue) !important;
  color: var(--bg-soft);
  padding: 60px 20px 30px;
  margin-top: 60px;
  border-top: 3px solid var(--old-gold);
  font-family: 'Inter', sans-serif;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
}

.footer-social {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-bottom: 40px;
  flex-wrap: wrap;
}

.social-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--bg-soft);
  text-decoration: none;
  transition: all 0.3s;
}

.social-icon:hover {
  color: var(--old-gold);
  transform: translateY(-3px);
}

.social-icon svg {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

.footer-contact {
  text-align: center;
  margin: 40px 0;
  padding: 20px 0;
  border-top: 1px solid rgba(255,255,255,0.1);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.contact-email {
  color: var(--old-gold);
  text-decoration: none;
  font-size: 1rem;
}

.contact-email:hover {
  text-decoration: underline;
}

.footer-nav-links {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin: 30px 0;
  flex-wrap: wrap;
}

.footer-nav-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--bg-soft);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.3s;
}

.footer-nav-link:hover {
  color: var(--old-gold);
}

.footer-bottom {
  text-align: center;
  font-size: 9px;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
  letter-spacing: 4px;
  padding-top: 30px;
}
/* EFECTO DE TINTA REALISTA (USAR CON MODERACIÓN) */
.main-classic-title {
  position: relative;
}

.main-classic-title::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse at 30% 40%,
    rgba(0, 26, 54, 0.03) 0%,
    transparent 70%
  );
  pointer-events: none;
  mix-blend-mode: multiply;
}
/* ===== RESPONSIVE ===== */
@media (max-width: 1100px) {
  .main-wrapper {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .toc-sidebar, .right-sidebar {
    display: none;
  }
  .main-classic-title {
    font-size: 2.2rem;
  }
  .archive-metadata {
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }
}

@media (max-width: 900px) {
  .sd-header-top {
    padding: 0.6rem 1.5rem;
  }
  
  .sd-logo-img {
    height: 36px;
  }
  
  .sd-search-wrapper,
  .sd-user-nav {
    display: none;
  }
  
  .sd-mobile-controls {
    display: flex;
  }
  
  .sd-mobile-search-btn,
  .sd-mobile-menu-btn {
    display: block;
  }
}

@media (max-width: 600px) {
  .sd-header-top {
    padding: 0.4rem 1rem;
  }
  
  .sd-logo-img {
    display: none;
  }
  
  .sd-journal-titles {
    border-left: none;
    padding-left: 0;
  }
  
  .sd-journal-name {
    font-size: 0.75rem;
    max-width: 180px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .sd-issn {
    font-size: 0.6rem;
  }
  
  .sd-mobile-controls {
    gap: 0.25rem;
  }
  
  .sd-mobile-search-btn svg,
  .sd-mobile-menu-btn svg {
    width: 20px;
    height: 20px;
  }
  
  .main-wrapper {
    padding: 1rem;
  }
  
  .seminal-title-container {
    padding: 20px 10px;
  }
  
  .main-classic-title {
    font-size: 1.8rem;
  }
  
  .original-title {
    font-size: 1.1rem;
  }
  
  .archive-metadata {
    font-size: 0.65rem;
  }
  
  .authors {
    font-size: 1rem;
  }
  
  .sidenote {
    float: none;
    width: 100%;
    margin: 1rem 0;
  }
  
  .code-block-wrapper {
    margin: 1rem 0;
    font-size: 0.75rem;
  }
  
  .code-block-container {
    overflow-x: auto;
  }
  
  .table-wrapper {
    margin: 1rem 0;
    overflow-x: auto;
  }
  
  .article-table {
    font-size: 0.8rem;
  }
  
  blockquote {
    margin: 1.5rem 1rem;
    font-size: 1rem;
  }
}
  </style>
</head>
<body>
  <!-- HEADER (preservado del original) -->
  <header class="sd-header">
    <div class="sd-header-top">
      <div class="sd-brand-container">
        <a href="/" class="sd-journal-logo">
          <img src="${LOGO_ES}" alt="Logo RNCE" class="sd-logo-img">
          <div class="sd-journal-titles">
            <span class="sd-journal-name">${JOURNAL_NAME_ES}</span>
            <span class="sd-issn">ISSN: 3087-2839</span>
          </div>
        </a>
      </div>
      
      <div class="sd-search-wrapper">
        <form id="search-form" class="sd-search-bar">
          <svg class="sd-search-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input type="text" id="search-input" placeholder="Buscar en la colección...">
        </form>
      </div>
      
      <div class="sd-user-nav">
        <a href="/collections/classic-science/" class="sd-nav-link">Clásicos</a>
        <a href="/" class="sd-nav-link">Inicio</a>
      </div>
      
      <div class="sd-mobile-controls">
        <button class="sd-mobile-menu-btn" onclick="toggleMobileMenu()" aria-label="Menú">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
      </div>
    </div>
  </header>

  <!-- Overlay para menú móvil -->
  <div class="sd-mobile-overlay" id="mobileOverlay" onclick="closeMobileMenu()"></div>

  <!-- Menú móvil -->
  <div class="sd-mobile-menu" id="mobileMenu">
    <div class="sd-mobile-menu-header">
      <span class="sd-mobile-menu-title">MENÚ DEL ARTÍCULO</span>
      <button class="sd-mobile-close-btn" onclick="closeMobileMenu()">
        <svg viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
    
    <!-- Búsqueda móvil -->
    <div class="sd-mobile-search">
      <form id="mobile-search-form" class="sd-mobile-search-bar" onsubmit="handleMobileSearch(event)">
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input type="text" id="mobile-search-input" placeholder="Buscar en la colección...">
      </form>
    </div>
    
    <!-- Sección: CONTENIDO DEL ARTÍCULO -->
    <div class="sd-mobile-nav-section">
      <div class="sd-mobile-nav-section-title">CONTENIDO</div>
      <ul class="sd-mobile-nav-items" id="mobile-toc-list">
        <!-- Se generará dinámicamente con JavaScript -->
      </ul>
    </div>
    
    <!-- Sección: NOTAS MARGINALES -->
    <div class="sd-mobile-nav-section">
      <div class="sd-mobile-nav-section-title">NOTAS MARGINALES</div>
      <ul class="sd-mobile-nav-items" id="mobile-notes-list">
        ${marginNotes.map(note => `
        <li class="sd-mobile-nav-item">
          <a href="#${note.id}" class="sd-mobile-nav-link" onclick="event.preventDefault(); highlightAndScrollToMargin('${note.id}', ${note.number}); closeMobileMenu();">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <path d="M8 4v5M8 11v1" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <span>Nota ${note.number}</span>
            <span class="sd-mobile-nav-badge">${note.text.substring(0, 30)}${note.text.length > 30 ? '...' : ''}</span>
          </a>
        </li>
        `).join('')}
      </ul>
    </div>
    
    <!-- Footer del menú móvil -->
    <div class="sd-mobile-menu-footer">
      <div>ISSN: 3087-2839</div>
      <div style="margin-top: 0.5rem; font-size: 0.7rem;">
        &copy; ${new Date().getFullYear()} RNCE
      </div>
    </div>
  </div>

  <div class="main-wrapper">
    <!-- SIDEBAR IZQUIERDA - TABLA DE CONTENIDOS -->
    <nav class="toc-sidebar">
      <div class="toc-title">CONTENIDO</div>
      <ul class="toc-list" id="toc-list">
        ${tocHtml}
      </ul>
    </nav>

    <!-- CONTENIDO PRINCIPAL -->
    <main class="article-container">
      <article>
        <!-- TÍTULO SEMINAL -->
        <div class="seminal-title-container">
  <span class="collection-tag">Clásicos de la Ciencia</span>
  <h1 class="main-classic-title" data-title-length="${title.length}">${title}</h1>
  ${originalTitle ? `<div class="original-title">${originalTitle}</div>` : ''}
  <div class="title-separator"></div>
          
          <!-- METADATA DE ARCHIVO -->

<div class="archive-metadata">
  ${article['original-date'] ? `
  <div class="meta-column">
    <span class="meta-label">Año original</span>
    <span class="meta-value">${(() => {
      // Extraer solo el año de original-date
      const date = article['original-date'];
      if (date.match(/^\d{4}$/)) return date;
      if (date.match(/^\d{2}-\d{2}-\d{4}$/)) return date.split('-')[2];
      try {
        return new Date(date).getFullYear();
      } catch {
        return date;
      }
    })()}</span>
  </div>
  ` : ''}
  
  <div class="meta-column">
    <span class="meta-label">Año traducción</span>
    <span class="meta-value">${new Date().getFullYear()}</span>
  </div>
  
  <div class="meta-column">
    <span class="meta-label">Idioma original</span>
    <span class="meta-value">${article.idioma || 'No especificado'}</span>
  </div>
</div>
</div>
        <!-- AUTORES -->
        <div class="authors-section">
          <div class="authors">
            ${authorsDisplay}
          </div>
        </div>

        <!-- EDITORES (si existen) -->
        ${article.editor && article.editor.length > 0 ? `
        <div class="collaborators-section">
          <h4 style="font-family:'Inter',sans-serif; font-size:0.8rem; text-transform:uppercase;">Edición a cargo de</h4>
          ${article.editor.map(ed => `
            <div class="collaborator-item">
              <span class="collaborator-name">${ed.website ? `<a href="${ed.website}" target="_blank">${ed.name}</a>` : ed.name}</span>
              ${ed.orcid ? `<a href="https://orcid.org/${ed.orcid}" target="_blank" class="author-icon">${orcidSvg}</a>` : ''}
              ${ed.email ? `<a href="mailto:${ed.email}" class="author-icon">${emailSvg}</a>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- COLABORADORES -->
        ${collaboratorsHtml ? `
        <div class="collaborators-section">
          <h4 style="font-family:'Inter',sans-serif; font-size:0.8rem; text-transform:uppercase;">Colaboradores</h4>
          ${collaboratorsHtml}
        </div>
        ` : ''}

        <!-- BARRA DE ACCIONES -->
        ${article['pdf-url'] ? `
        <div class="action-bar">
          <a href="${article['pdf-url']}" target="_blank" rel="noopener" class="btn-pdf">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Abrir PDF
          </a>
          <span class="oa-label">
            ${oaSvg}
            Open Access
          </span>
        </div>
        ` : ''}

        <!-- ABSTRACT -->
        ${article.abstract ? `
        <section class="abstract-section" id="abstract">
          <h2>Resumen</h2>
          <div class="abstract-text">
            ${article.abstract}
          </div>
          ${article.keywords && article.keywords.length > 0 ? `
          <div class="keywords">
            ${article.keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
          </div>
          ` : ''}
        </section>
        ` : ''}

        <!-- NOTA EDITORIAL -->
        ${article['editorial-note'] ? `
        <div class="editorial-note" id="editorial-note">
          <h3>Nota de la edición</h3>
          ${article['editorial-note']}
        </div>
        ` : ''}

        <!-- CONTENIDO DEL ARTÍCULO -->
        <section class="article-content" id="full-text">
          ${processedHtml || '<p>El texto completo estará disponible próximamente.</p>'}
        </section>

        <!-- REFERENCIAS -->
        ${referencesHtml ? `
        <section id="references">
          <h2>Referencias</h2>
          ${referencesHtml}
        </section>
        ` : ''}

        <!-- APÉNDICE -->
        ${appendixHtml ? `
        <section class="appendix-section" id="appendix">
          <h2>Apéndice</h2>
          ${appendixHtml}
        </section>
        ` : ''}
<!-- PREVISUALIZACIÓN PDF -->
        ${pdfPreviewHtml ? pdfPreviewHtml : ''}

        <!-- LICENCIA -->
        <section class="license-section">
          <p>
            <strong>Licencia:</strong> 
            Este artículo se publica bajo la licencia 
            <a href="https://creativecommons.org/licenses/by/4.0/deed.es" target="_blank" rel="license noopener">
              ${ccLogoSvg} CC BY 4.0
            </a>
          </p>
        </section>
      </article>
        <div class="mobile-info">
          <div class="info-tabs">
            <div class="tab-buttons">
              <button class="tab-button active" onclick="switchTab('mobile', 'citations')">Cómo citar</button>
              <button class="tab-button" onclick="switchTab('mobile', 'info')">Información</button>
              <button class="tab-button" onclick="switchTab('mobile', 'notes')">Notas</button>
            </div>


            <div id="mobile-citations" class="tab-panel active">
              <h4>Cómo citar</h4>
              <div class="citation-box">
                <div class="citation-item">
                  <strong>APA</strong>
                  <button class="copy-btn" onclick="copyText('apa-citation', this)">Copiar</button>
                  <div id="apa-citation-mobile" style="margin-top:0.25rem;">${citations.apa}</div>
                </div>
                <div class="citation-item">
                  <strong>MLA</strong>
                  <button class="copy-btn" onclick="copyText('mla-citation', this)">Copiar</button>
                  <div id="mla-citation-mobile" style="margin-top:0.25rem;">${citations.mla}</div>
                </div>
                <div class="citation-item">
                  <strong>Chicago</strong>
                  <button class="copy-btn" onclick="copyText('chicago-citation', this)">Copiar</button>
                  <div id="chicago-citation-mobile" style="margin-top:0.25rem;">${citations.chicago}</div>
                </div>
                 <a href="data:text/plain;charset=utf-8,${encodeURIComponent(citations.bibtex)}"
                   download="${generateSlug(article['name-translated'] || article['name-original'])}.bib"
                   class="bibtex-download-btn" style="margin-left: 0;">
                  Descargar BibTeX
                </a>
              </div>
            </div>

            <div id="mobile-info" class="tab-panel">
              <h4>Palabras clave</h4>
              <div class="keywords" style="margin-bottom: 1.5rem;">
                ${(article.keywords || []).map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
              </div>
              <h4>Detalles del documento</h4>
              <div class="metadata-item">
                <span class="metadata-label">ID</span>
                <span class="metadata-value">${article.id || 'N/A'}</span>
              </div>
              <div class="metadata-item">
  <span class="metadata-label">Año original</span>
  <span class="metadata-value">${(() => {
    const date = article['original-date'];
    if (!date) return 'N/A';
    if (date.match(/^\d{4}$/)) return date;
    if (date.match(/^\d{2}-\d{2}-\d{4}$/)) return date.split('-')[2];
    try {
      return new Date(date).getFullYear();
    } catch {
      return date;
    }
  })()}</span>
</div>
<div class="metadata-item">
  <span class="metadata-label">Año traducción</span>
  <span class="metadata-value">${new Date().getFullYear()}</span>
</div>
<div class="metadata-item">
  <span class="metadata-label">Idioma original</span>
  <span class="metadata-value">${article.idioma || 'No especificado'}</span>
</div>
            </div>

            <div id="mobile-notes" class="tab-panel">
              <h4>Notas al margen</h4>
              ${marginNotes && marginNotes.length > 0 ? `
              <ul class="margin-notes-list">
                ${marginNotes.map(note => `
                  <li class="margin-note-item" id="mobile-margin-${note.id}">
                    <span class="margin-note-number">[${note.number}]</span>
                    <span class="margin-note-content">${note.text}</span>
                    <span class="margin-note-backlink">
                      <a href="#${note.id}" onclick="event.preventDefault(); scrollToMarginNote('${note.id}');">↩ Volver al texto</a>
                    </span>
                  </li>
                `).join('')}
              </ul>
              ` : '<p>No hay notas marginales en este documento.</p>'}
            </div>
          </div>
        </div>

    </main>

    <!-- SIDEBAR DERECHA CON PESTAÑAS -->
    <aside class="right-sidebar">
      <div class="info-tabs">
        <div class="tab-buttons">
          <button class="tab-button active" onclick="switchTab('citations')">Cómo citar</button>
          <button class="tab-button" onclick="switchTab('info')">Información</button>
          <button class="tab-button" onclick="switchTab('notes')">Notas</button>
        </div>
        
<!-- CÓMO CITAR -->
<div id="citations-panel" class="tab-panel active">
  <div class="citation-box">
    <div class="citation-item">
      <strong>APA</strong>
      <button class="copy-btn" onclick="copyText('apa-citation', this)">Copiar</button>
      <div id="apa-citation" style="margin-top:0.25rem;">
        ${citations.apa}
      </div>
    </div>
    <div class="citation-item">
      <strong>MLA</strong>
      <button class="copy-btn" onclick="copyText('mla-citation', this)">Copiar</button>
      <div id="mla-citation" style="margin-top:0.25rem;">
        ${citations.mla}
      </div>
    </div>
    <div class="citation-item">
      <strong>Chicago</strong>
      <button class="copy-btn" onclick="copyText('chicago-citation', this)">Copiar</button>
      <div id="chicago-citation" style="margin-top:0.25rem;">
        ${citations.chicago}
      </div>
    </div>
    <div class="citation-item" style="border-bottom: none;">
  <strong>BibTeX</strong>
  <a href="data:text/plain;charset=utf-8,${encodeURIComponent(citations.bibtex)}" 
     download="${generateSlug(article['name-translated'] || article['name-original'])}.bib"
     class="bibtex-download-btn"
     style="display: inline-flex; align-items: center; gap: 8px; margin-left: 1rem; color: var(--oxford-blue); text-decoration: none; font-size: 0.8rem; font-weight: 500;">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
    </svg>
    Descargar .bib
  </a>
  <!-- Opcional: mantener el preview del BibTeX para referencia -->
  <div style="margin-top: 0.5rem; font-family: monospace; font-size: 0.7rem; white-space: pre-wrap; background: var(--bg-soft); padding: 0.5rem; border-radius: 4px; max-height: 200px; overflow-y: auto;">
    ${citations.bibtex}
  </div>
</div>

          </div>
        </div>
        
        <!-- INFORMACIÓN -->
        <div id="info-panel" class="tab-panel">
          <h4>Detalles del documento</h4>
          <div class="metadata-item">
            <span class="metadata-label">ID</span>
            <span class="metadata-value">${article.id || 'N/A'}</span>
          </div>
          <div class="metadata-item">
  <span class="metadata-label">Año original</span>
  <span class="metadata-value">${(() => {
    const date = article['original-date'];
    if (!date) return 'N/A';
    if (date.match(/^\d{4}$/)) return date;
    if (date.match(/^\d{2}-\d{2}-\d{4}$/)) return date.split('-')[2];
    try {
      return new Date(date).getFullYear();
    } catch {
      return date;
    }
  })()}</span>
</div>
<div class="metadata-item">
  <span class="metadata-label">Año traducción</span>
  <span class="metadata-value">${new Date().getFullYear()}</span>
</div>
<div class="metadata-item">
  <span class="metadata-label">Idioma original</span>
  <span class="metadata-value">${article.idioma || 'No especificado'}</span>
</div>
          ${article.keywords && article.keywords.length > 0 ? `
          <h4 style="margin-top:1rem;">Palabras clave</h4>
          <div class="keywords">
            ${article.keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
          </div>
          ` : ''}
        </div>
        
       <!-- NOTAS MARGINALES (no editoriales) -->
<div id="notes-panel" class="tab-panel">
  <h4>Notas al margen</h4>
  ${marginNotes && marginNotes.length > 0 ? `
  <ul class="margin-notes-list">
    ${marginNotes.map(note => `
      <li class="margin-note-item" id="sidebar-margin-${note.id}">
        <span class="margin-note-number">[${note.number}]</span>
        <span class="margin-note-content">${note.text}</span>
        <span class="margin-note-backlink">
          <a href="#${note.id}" onclick="event.preventDefault(); scrollToMarginNote('${note.id}');">↩ Volver al texto</a>
        </span>
      </li>
    `).join('')}
  </ul>
  ` : '<p>No hay notas marginales en este documento.</p>'}
</div>
</div>
</aside>
</div>

  <!-- FOOTER (preservado del original) -->
  <footer class="footer">
    <div class="footer-container">
      <div class="footer-social">
        <a href="${socialLinks.instagram}" target="_blank" rel="noopener" class="social-icon">
          ${socialIcons.instagram}
          <span class="social-label">Instagram</span>
        </a>
        <a href="${socialLinks.youtube}" target="_blank" rel="noopener" class="social-icon">
          ${socialIcons.youtube}
          <span class="social-label">YouTube</span>
        </a>
        <a href="${socialLinks.tiktok}" target="_blank" rel="noopener" class="social-icon">
          ${socialIcons.tiktok}
          <span class="social-label">TikTok</span>
        </a>
        <a href="${socialLinks.spotify}" target="_blank" rel="noopener" class="social-icon">
          ${socialIcons.spotify}
          <span class="social-label">Spotify</span>
        </a>
      </div>

      <div class="footer-contact">
        <a href="mailto:contact@revistacienciasestudiantes.com" class="contact-email">
          contact@revistacienciasestudiantes.com
        </a>
      </div>

      <div class="footer-nav-links">
        <a href="/collections/classic-science/" class="footer-nav-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
          </svg>
          Volver a la colección
        </a>
        <a href="/" class="footer-nav-link">
          Volver al inicio
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </a>
      </div>

      <div class="footer-bottom">
        <p>© ${new Date().getFullYear()} ${JOURNAL_NAME_ES} · Colección Clásicos de la Ciencia</p>
      </div>
    </div>
  </footer>

  <!-- MODALES DE AUTORES -->
  ${authorModals}
<script>
// ========== FUNCIONES PARA MODALES DE AUTORES ==========
function openAuthorModal(authorId) {
  const modal = document.getElementById('author-modal-' + authorId);
  if (modal) {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }
}

function closeAuthorModal(authorId) {
  const modal = document.getElementById('author-modal-' + authorId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Cerrar modal haciendo clic fuera del contenido
window.addEventListener('click', function(event) {
  if (event.target.classList.contains('author-modal')) {
    event.target.style.display = 'none';
    document.body.style.overflow = '';
  }
});

// ========== FUNCIÓN PRINCIPAL PARA NOTAS MARGINALES (UNIFICADA) ==========
function openMarginNote(marginId, marginNumber) {
  console.log('Abriendo nota marginal:', marginId, marginNumber);
  
  // 1. Resaltar el marcador en el texto
  const marker = document.getElementById(marginId);
  if (marker) {
    marker.classList.add('margin-note-highlight');
    setTimeout(function() {
      marker.classList.remove('margin-note-highlight');
    }, 2000);
  }
  
  // 2. Determinar si es móvil (usando el mismo breakpoint del CSS: 1100px)
  const isMobile = window.innerWidth <= 1100;
  
  if (isMobile) {
    // === MODO MÓVIL: usar la sección inferior ===
    console.log('Modo móvil: usando sección inferior');
    
    // Cambiar a la pestaña de notas
    const mobileNotesBtn = document.querySelector('.mobile-info .tab-button:nth-child(3)');
    if (mobileNotesBtn) {
      // Extraer el nombre de la pestaña del texto del botón
      const btnText = mobileNotesBtn.textContent.toLowerCase();
      if (btnText.includes('notas')) {
        switchTab('notes');
      } else {
        mobileNotesBtn.click();
      }
    }
    
    // Scroll a la sección móvil y resaltar la nota específica
    setTimeout(function() {
      const mobileSection = document.querySelector('.mobile-info');
      if (mobileSection) {
        mobileSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      const mobileNote = document.getElementById('mobile-margin-' + marginId);
      if (mobileNote) {
        mobileNote.classList.add('margin-note-highlight');
        mobileNote.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function() {
          mobileNote.classList.remove('margin-note-highlight');
        }, 2000);
      }
    }, 300);
    
  } else {
    // === MODO ESCRITORIO: usar la sidebar derecha ===
    console.log('Modo escritorio: usando sidebar derecha');
    
    // Cambiar a la pestaña de notas en la sidebar
    const desktopNotesBtn = document.querySelector('.right-sidebar .tab-button:nth-child(3)');
    if (desktopNotesBtn) {
      const btnText = desktopNotesBtn.textContent.toLowerCase();
      if (btnText.includes('notas')) {
        switchTab('notes');
      } else {
        desktopNotesBtn.click();
      }
    }
    
    // Resaltar la nota en la sidebar
    setTimeout(function() {
      const sidebarNote = document.getElementById('sidebar-margin-' + marginId);
      if (sidebarNote) {
        sidebarNote.classList.add('margin-note-highlight');
        sidebarNote.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(function() {
          sidebarNote.classList.remove('margin-note-highlight');
        }, 2000);
      }
    }, 300);
  }
}

// ========== FUNCIÓN PARA VOLVER AL TEXTO DESDE UNA NOTA ==========
function scrollToTextMarker(marginId) {
  const marker = document.getElementById(marginId);
  if (marker) {
    marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
    marker.classList.add('margin-note-highlight');
    setTimeout(function() {
      marker.classList.remove('margin-note-highlight');
    }, 2000);
  }
  
  // En móvil, cerrar el menú si está abierto
  if (window.innerWidth <= 900) {
    closeMobileMenu();
  }
}

// ========== FUNCIÓN PARA PESTAÑAS (SIDEBAR Y MÓVIL) ==========
function switchTab(tabName) {
  console.log('Cambiando a pestaña:', tabName);
  
  // Panel de escritorio (sidebar derecha)
  const desktopPanels = {
    citations: document.getElementById('citations-panel'),
    info: document.getElementById('info-panel'),
    notes: document.getElementById('notes-panel')
  };
  
  // Botones de escritorio
  const desktopButtons = document.querySelectorAll('.right-sidebar .tab-button');
  
  // Ocultar todos los paneles de escritorio
  if (desktopPanels.citations) desktopPanels.citations.classList.remove('active');
  if (desktopPanels.info) desktopPanels.info.classList.remove('active');
  if (desktopPanels.notes) desktopPanels.notes.classList.remove('active');
  
  // Desactivar todos los botones de escritorio
  desktopButtons.forEach(function(btn) {
    btn.classList.remove('active');
  });
  
  // Activar el panel de escritorio seleccionado
  if (desktopPanels[tabName]) {
    desktopPanels[tabName].classList.add('active');
  }
  
  // Activar el botón de escritorio correspondiente
  desktopButtons.forEach(function(btn) {
    const btnText = btn.textContent.toLowerCase();
    if (tabName === 'citations' && btnText.includes('citar')) {
      btn.classList.add('active');
    } else if (tabName === 'info' && btnText.includes('información')) {
      btn.classList.add('active');
    } else if (tabName === 'notes' && btnText.includes('notas')) {
      btn.classList.add('active');
    }
  });
  
  // ===== TAMBIÉN ACTUALIZAR PESTAÑAS MÓVILES =====
  const mobilePanels = {
    citations: document.getElementById('mobile-citations'),
    info: document.getElementById('mobile-info'),
    notes: document.getElementById('mobile-notes')
  };
  
  const mobileButtons = document.querySelectorAll('.mobile-info .tab-button');
  
  // Ocultar paneles móviles
  if (mobilePanels.citations) mobilePanels.citations.classList.remove('active');
  if (mobilePanels.info) mobilePanels.info.classList.remove('active');
  if (mobilePanels.notes) mobilePanels.notes.classList.remove('active');
  
  // Desactivar botones móviles
  mobileButtons.forEach(function(btn) {
    btn.classList.remove('active');
  });
  
  // Activar panel móvil seleccionado
  if (mobilePanels[tabName]) {
    mobilePanels[tabName].classList.add('active');
  }
  
  // Activar botón móvil correspondiente
  mobileButtons.forEach(function(btn) {
    const btnText = btn.textContent.toLowerCase();
    if (tabName === 'citations' && btnText.includes('citar')) {
      btn.classList.add('active');
    } else if (tabName === 'info' && btnText.includes('información')) {
      btn.classList.add('active');
    } else if (tabName === 'notes' && btnText.includes('notas')) {
      btn.classList.add('active');
    }
  });
}

// ========== FUNCIÓN PARA COPIAR TEXTO (CITAS) ==========
function copyText(elementId, btnElement) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const text = element.innerText || element.textContent;
  
  navigator.clipboard.writeText(text.trim()).then(function() {
    // Guardar texto original
    const originalText = btnElement ? btnElement.innerText : 'Copiar';
    
    if (btnElement) {
      btnElement.innerText = '✓ Copiado';
      btnElement.style.background = '#22c55e';
      btnElement.style.color = 'white';
      btnElement.style.borderColor = '#22c55e';
      
      setTimeout(function() {
        btnElement.innerText = originalText;
        btnElement.style.background = '';
        btnElement.style.color = '';
        btnElement.style.borderColor = '';
      }, 2000);
    }
  }).catch(function(err) {
    console.error('Error al copiar:', err);
    // Fallback para navegadores antiguos
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Texto copiado al portapapeles');
    } catch (e) {
      alert('No se pudo copiar el texto. Por favor, cópialo manualmente.');
    }
  });
}

// ========== FUNCIÓN PARA COPIAR CÓDIGO ==========
function copyCode(codeId, btn) {
  const codeElement = document.getElementById(codeId);
  if (!codeElement) return;
  
  const code = codeElement.querySelector('code') ? 
               codeElement.querySelector('code').textContent : 
               codeElement.textContent;
  
  navigator.clipboard.writeText(code).then(function() {
    const copyTextSpan = btn.querySelector('.copy-text');
    const originalText = copyTextSpan ? copyTextSpan.textContent : 'Copiar';
    
    if (copyTextSpan) {
      copyTextSpan.textContent = '✓ Copiado';
    }
    btn.style.background = '#22c55e';
    btn.style.color = 'white';
    btn.style.borderColor = '#22c55e';
    
    setTimeout(function() {
      if (copyTextSpan) {
        copyTextSpan.textContent = originalText;
      }
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 2000);
  }).catch(function(err) {
    console.error('Error al copiar código:', err);
    alert('No se pudo copiar automáticamente. Selecciona el código y usa Ctrl+C');
  });
}

// ========== FUNCIONES PARA MENÚ MÓVIL ==========
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileOverlay');
  
  if (menu) {
    menu.classList.toggle('active');
  }
  if (overlay) {
    overlay.classList.toggle('active');
  }
  
  if (menu && menu.classList.contains('active')) {
    document.body.style.overflow = 'hidden';
    generateMobileTOC();
  } else {
    document.body.style.overflow = '';
  }
}

function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileOverlay');
  
  if (menu) menu.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function handleMobileSearch(e) {
  e.preventDefault();
  const query = document.getElementById('mobile-search-input').value.trim();
  if (query) {
    window.location.href = '/buscar?q=' + encodeURIComponent(query);
  }
}

// ========== GENERAR TABLA DE CONTENIDOS PARA MÓVIL ==========
function generateMobileTOC() {
  const mobileTocList = document.getElementById('mobile-toc-list');
  if (!mobileTocList) return;
  
  mobileTocList.innerHTML = '';
  
  // Añadir resumen si existe
  const abstract = document.getElementById('abstract');
  if (abstract) {
    const li = document.createElement('li');
    li.className = 'sd-mobile-nav-item';
    li.innerHTML = '<a href="#abstract" class="sd-mobile-nav-link" onclick="closeMobileMenu()">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M4 6H20v2H4zM4 12H20v2H4zM4 18H20v2H4z"/>' +
      '</svg>' +
      '<span>Resumen</span>' +
    '</a>';
    mobileTocList.appendChild(li);
  }
  
  // Obtener todos los encabezados h2
  const headings = document.querySelectorAll('.article-container h2');
  
  headings.forEach(function(heading, index) {
    if (!heading.id) {
      heading.id = 'section-' + index;
    }
    
    const li = document.createElement('li');
    li.className = 'sd-mobile-nav-item';
    li.innerHTML = '<a href="#' + heading.id + '" class="sd-mobile-nav-link" onclick="closeMobileMenu()">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M4 6H20v2H4zM4 12H20v2H4zM4 18H20v2H4z"/>' +
      '</svg>' +
      '<span>' + heading.textContent + '</span>' +
    '</a>';
    mobileTocList.appendChild(li);
  });
}

// ========== CONFIGURAR RESALTADO DEL TOC AL HACER SCROLL ==========
function setupTOCHighlight() {
  const tocLinks = document.querySelectorAll('.toc-item a');
  const sections = [];
  
  tocLinks.forEach(function(link) {
    const href = link.getAttribute('href');
    if (href && href !== '#') {
      const section = document.querySelector(href);
      if (section) {
        sections.push({
          link: link,
          section: section,
          top: 0
        });
      }
    }
  });
  
  function updateSectionPositions() {
    sections.forEach(function(item) {
      const rect = item.section.getBoundingClientRect();
      item.top = rect.top + window.scrollY;
    });
  }
  
  function highlightActiveSection() {
    const scrollPosition = window.scrollY + 150;
    
    let currentSection = null;
    for (let i = sections.length - 1; i >= 0; i--) {
      if (sections[i].top <= scrollPosition) {
        currentSection = sections[i];
        break;
      }
    }
    
    tocLinks.forEach(function(link) {
      link.classList.remove('active');
    });
    
    if (currentSection) {
      currentSection.link.classList.add('active');
    }
  }
  
  setTimeout(updateSectionPositions, 100);
  window.addEventListener('resize', updateSectionPositions);
  window.addEventListener('scroll', highlightActiveSection);
  setTimeout(highlightActiveSection, 200);
}

// ========== CONFIGURAR SCROLL SUAVE ==========
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        history.pushState(null, null, href);
      }
    });
  });
}

// ========== INICIALIZAR HIGHLIGHT.JS ==========
function setupHighlightJS() {
  if (window.hljs) {
    document.querySelectorAll('pre code').forEach(function(block) {
      hljs.highlightElement(block);
    });
  }
}

// ========== INICIALIZAR MATHJAX ==========
function setupMathJax() {
  if (window.MathJax) {
    MathJax.typesetPromise();
  }
}

// ========== MANEJO DE NOTAS AL PIE (POP-UP) ==========
function setupFootnotePopups() {
  document.querySelectorAll('.footnote-link').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      const note = document.getElementById(targetId);
      
      if (note) {
        // Ocultar cualquier otra nota abierta
        document.querySelectorAll('.footnote-content').forEach(function(n) {
          if (n.id !== targetId) {
            n.style.display = 'none';
          }
        });
        
        // Toggle la nota actual
        if (note.style.display === 'block') {
          note.style.display = 'none';
        } else {
          note.style.display = 'block';
          
          // Cerrar al hacer clic fuera
          setTimeout(function() {
            function closeHandler(e) {
              if (note && !note.contains(e.target) && e.target !== link) {
                note.style.display = 'none';
                document.removeEventListener('click', closeHandler);
              }
            }
            document.addEventListener('click', closeHandler);
          }, 100);
        }
      }
    });
  });
}
// ========== DETECCIÓN Y ADAPTACIÓN DE TÍTULOS LARGOS ==========
function adaptLongTitles() {
  const titleElement = document.querySelector('.main-classic-title');
  if (!titleElement) return;
  
  const titleText = titleElement.innerText || titleElement.textContent;
  
  // Criterios para considerar un título "muy largo"
  const isVeryLong = 
    titleText.length > 80 ||           // Más de 80 caracteres
    titleText.split(' ').length > 15;   // Más de 15 palabras
  
  if (isVeryLong) {
    titleElement.classList.add('main-classic-title--very-long');
    
    // Opcional: Insertar un <wbr> (word break) después de signos de puntuación
    // para ayudar al navegador a decidir dónde cortar
    const words = titleText.split(' ');
    if (words.length > 12) {
      let newHtml = '';
      words.forEach((word, index) => {
        newHtml += word;
        if (index === 4 || index === 8) {
          newHtml += '<wbr>'; // Punto de ruptura sugerido
        }
        if (index < words.length - 1) {
          newHtml += ' ';
        }
      });
      titleElement.innerHTML = newHtml;
    }
  }
}

// Llamar a la función cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  adaptLongTitles();
  console.log('DOM cargado, inicializando...');
  
  setupTOCHighlight();
  setupSmoothScroll();
  setupHighlightJS();
  setupMathJax();
  setupFootnotePopups();
  
  // Inicializar botones de copiado
  document.querySelectorAll('.copy-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const onclickAttr = this.getAttribute('onclick');
      if (onclickAttr) {
        const match = onclickAttr.match(/'([^']+)'/);
        if (match && match[1]) {
          copyText(match[1], this);
        }
      }
    });
  });
  
  // Inicializar pestañas (sidebar)
  document.querySelectorAll('.right-sidebar .tab-button').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const btnText = this.textContent.toLowerCase();
      if (btnText.includes('citar')) {
        switchTab('citations');
      } else if (btnText.includes('información')) {
        switchTab('info');
      } else if (btnText.includes('notas')) {
        switchTab('notes');
      }
    });
  });
  
  // Inicializar pestañas (móvil)
  document.querySelectorAll('.mobile-info .tab-button').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const btnText = this.textContent.toLowerCase();
      if (btnText.includes('citar')) {
        switchTab('citations');
      } else if (btnText.includes('información')) {
        switchTab('info');
      } else if (btnText.includes('notas')) {
        switchTab('notes');
      }
    });
  });
  
  // Activar pestaña de citas por defecto
  setTimeout(function() {
    switchTab('citations');
  }, 100);
});

// ========== CERRAR MENÚ CON TECLA ESCAPE ==========
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeMobileMenu();
    
    // También cerrar modales de autores
    document.querySelectorAll('.author-modal').forEach(function(modal) {
      modal.style.display = 'none';
    });
    document.body.style.overflow = '';
  }
});

// ========== EVITAR PROPAGACIÓN DE EVENTOS EN MODALES ==========
document.querySelectorAll('.author-modal-content').forEach(function(content) {
  content.addEventListener('click', function(e) {
    e.stopPropagation();
  });
});
</script>
  

</body>
</html>`;
}

// ========== FUNCIÓN PARA GENERAR ÍNDICE DE LA COLECCIÓN ==========
function generateCollectionIndex(articles) {
  const indexHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clásicos de la Ciencia - Índice de la colección</title>
  <link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+French+Canon:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --oxford-blue: #002147;
      --british-green: #004225;
      --accent-burgundy: #8b1e3f;
      --cream-bg: #fdfcf8;
      --text-main: #2c2c2c;
      --border-color: #e0dcd0;
    }
    body {
      font-family: 'IM Fell English', serif;
      background-color: var(--cream-bg);
      color: var(--text-main);
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    .header {
      background: white;
      border-bottom: 1px solid var(--border-color);
      padding: 1rem 2rem;
      text-align: center;
    }
    .collection-title {
      font-family: 'IM Fell French Canon', serif;
      font-size: 2.5rem;
      color: var(--oxford-blue);
      margin: 2rem 0 0.5rem;
      font-style: italic;
    }
    .collection-subtitle {
      font-family: 'Inter', sans-serif;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: var(--accent-burgundy);
      margin-bottom: 2rem;
    }
    .main-container {
      max-width: 1000px;
      margin: 2rem auto;
      padding: 0 2rem;
    }
    .articles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2rem;
      margin-top: 2rem;
    }
    .article-card {
      background: white;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
      transition: transform 0.2s, box-shadow 0.2s;
      text-decoration: none;
      color: inherit;
      display: block;
    }
    .article-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .article-id {
      font-family: 'Inter', sans-serif;
      font-size: 0.7rem;
      color: var(--accent-burgundy);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 0.5rem;
    }
    .article-title {
      font-family: 'IM Fell French Canon', serif;
      font-size: 1.3rem;
      color: var(--oxford-blue);
      margin: 0.5rem 0;
    }
    .article-author {
      font-family: 'Inter', sans-serif;
      font-size: 0.9rem;
      color: var(--text-main);
      margin: 0.5rem 0;
    }
    .article-date {
      font-family: 'Inter', sans-serif;
      font-size: 0.8rem;
      color: #666;
      margin-top: 0.5rem;
    }
    .footer {
      text-align: center;
      padding: 3rem;
      color: #666;
      font-family: 'Inter', sans-serif;
      font-size: 0.8rem;
      border-top: 1px solid var(--border-color);
      margin-top: 3rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="collection-title">Clásicos de la Ciencia</div>
    <div class="collection-subtitle">Traducciones académicas · Edición crítica</div>
  </div>
  
  <div class="main-container">
    <p style="font-size:1.1rem; text-align:center; margin-bottom:2rem;">
      La colección presenta traducciones al español de textos fundamentales de la historia de la ciencia, 
      con aparato editorial moderado y notas críticas.
    </p>
    
    <div class="articles-grid">
      ${articles.map(article => `
        <a href="${article.id}.html" class="article-card">
          <div class="article-id">${article.id || 'CC-0000-0000'}</div>
          <div class="article-title">${article['name-translated'] || article['name-original']}</div>
          <div class="article-author">${article.author && article.author[0] ? article.author[0].name : ''}</div>
          <div class="article-date">${article['original-date'] || ''}</div>
        </a>
      `).join('')}
    </div>
  </div>
  
  <div class="footer">
    <p>© ${new Date().getFullYear()} Revista Nacional de las Ciencias para Estudiantes · Colección Clásicos de la Ciencia</p>
    <p><a href="/" style="color:var(--oxford-blue);">Volver a la revista</a></p>
  </div>
</body>
</html>`;

  const indexPath = path.join(OUTPUT_DIR, 'index.html');
  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  console.log(`✅ Índice generado: ${indexPath}`);
}

// ========== EJECUCIÓN ==========
generateAll();