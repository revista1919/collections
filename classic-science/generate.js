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

// ========== CONTADOR PARA TABLAS ==========
let tableCounter = 1;
let figureCounter = 1;
let noteCounter = 1;
let appendixCounter = 1;

function resetCounters() {
  tableCounter = 1;
  figureCounter = 1;
  noteCounter = 1;
  appendixCounter = 1;
}

// ========== ICONOS Y SVG ==========
const orcidSvg = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" width="16" height="16"> <circle cx="128" cy="128" r="120" fill="#A6CE39"/> <g fill="#FFFFFF"> <rect x="71" y="78" width="17" height="102"/> <circle cx="79.5" cy="56" r="11"/> <path d="M103 78 v102 h41.5 c28.2 0 51-22.8 51-51 s-22.8-51-51-51 H103 zm17 17 h24.5 c18.8 0 34 15.2 34 34 s-15.2 34-34 34 H120 V95 z" fill-rule="evenodd"/> </g> </svg>`;

const emailSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;

// CORREGIDO: Logo Open Access en la orientación correcta (sin transformación matricial invertida)
const oaSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 500 260" style="vertical-align: middle;"><g transform="matrix(1.25 0 0 -1.25 0 360)"><path d="M262.883 200.896v-8.846h25.938v8.846c0 21.412 17.421 38.831 38.831 38.831 21.409 0 38.829-17.419 38.829-38.831v-63.985h25.939v63.985c0 35.713-29.056 64.769-64.768 64.769-35.711 0-64.769-29.056-64.769-64.769M349.153 99.568c0-11.816-9.58-21.396-21.399-21.396-11.818 0-21.398 9.58-21.398 21.396 0 11.823 9.58 21.404 21.398 21.404 11.819 0 21.399-9.581 21.399-21.404" fill="#f68212"/><path d="M277.068 99.799c0 27.811 22.627 50.436 50.438 50.436 27.809 0 50.433-22.625 50.433-50.436 0-27.809-22.624-50.438-50.433-50.438-27.811.001-50.438 22.63-50.438 50.438m-25.938 0c0-42.109 34.265-76.373 76.375-76.373 42.111 0 76.373 34.265 76.373 76.373 0 42.113-34.262 76.375-76.373 76.375-42.11 0-76.375-34.262-76.375-76.375" fill="#f68212"/></g></svg>`;

const ccLogoSvg = `<img src="https://bibliotecas.ucn.cl/wp-content/uploads/2025/04/by1.png" alt="CC BY 4.0" style="height: 1.2em; width: auto; vertical-align: middle;">`;

// Nuevo icono para notas marginales - más intuitivo
const marginalNoteIcon = `<svg class="marginal-note-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>`;

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

// ========== FUNCIÓN PARA PROCESAR ABSTRACT ==========
function processAbstract(abstract) {
  if (!abstract) return '';
  
  const $ = cheerio.load(`<div>${abstract}</div>`, { decodeEntities: false });
  
  // Procesar enlaces dentro del abstract
  $('a').each((i, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (href && !href.startsWith('http') && !href.startsWith('#')) {
      $el.attr('href', '#' + href);
    }
    $el.addClass('abstract-link');
  });
  
  return $.html();
}

// ========== FUNCIÓN PARA PROCESAR REFERENCIAS ==========
function processReferences(references) {
  if (!references) return '';
  
  const $ = cheerio.load(`<div>${references}</div>`, { decodeEntities: false });
  
  // Procesar cada referencia
  $('p, div').each((i, el) => {
    const $el = $(el);
    const text = $el.text();
    
    // Crear ID para la referencia
    const refId = `ref-${i + 1}`;
    $el.attr('id', refId);
    $el.addClass('reference-item');
    
    // Procesar enlaces DOI, ISBN, etc.
    $el.find('a').each((j, link) => {
      const $link = $(link);
      const href = $link.attr('href');
      if (href && href.startsWith('#')) {
        $link.addClass('reference-link');
      } else {
        $link.attr('target', '_blank');
        $link.attr('rel', 'noopener');
      }
    });
  });
  
  return $.html();
}

// ========== FUNCIÓN PARA PROCESAR APÉNDICE ==========
function processAppendix(appendix) {
  if (!appendix) return '';
  
  const $ = cheerio.load(`<div>${appendix}</div>`, { decodeEntities: false });
  
  // Encontrar y numerar secciones del apéndice
  $('h2, h3').each((i, el) => {
    const $el = $(el);
    const level = el.tagName.toLowerCase();
    const text = $el.text();
    
    if (level === 'h2') {
      $el.attr('id', `appendix-${appendixCounter}`);
      $el.html(`Apéndice ${appendixCounter}: ${text}`);
      appendixCounter++;
    } else {
      $el.attr('id', `appendix-sub-${i}`);
    }
  });
  
  return $.html();
}

// ========== FUNCIÓN PARA PROCESAR TABLAS ==========
function parseTable($, $table) {
  const table = {
    id: $table.attr('id') || `table-${tableCounter}`,
    number: tableCounter++,
    caption: $table.find('caption').text().trim() || null,
    headers: [],
    rows: [],
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
        rowspan: parseInt($cell.attr('rowspan')) || 1
      });
    });

    if (!headerProcessed && ($(row).find('th').length > 0 || i === 0)) {
      table.headers = rowData;
      headerProcessed = true;
    } else {
      table.rows.push(rowData);
    }
  });

  return table;
}

function formatCSVCell(text) {
  let cleanText = text.replace(/"/g, '""');
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
    caption: table.caption,
    headers: table.headers.map(h => h.text),
    rows: table.rows.map(row => row.map(cell => cell.text))
  };
  return JSON.stringify(simpleTable, null, 2);
}

function processTablesWithDownload($, html) {
  if (!html) return html;
  
  $('table').each((i, el) => {
    const $el = $(el);
    const tableModel = parseTable($, $el);
    
    // Generar todos los formatos
    const csvContent = tableToCSV(tableModel);
    const jsonContent = tableToJSON(tableModel);
    
    // Añadir BOM para UTF-8 en Excel
    const BOM = '\uFEFF';
    
    const tableWrapper = `
    <div class="table-download-wrapper" id="${tableModel.id}">
      <div class="table-header">
        <span class="table-label">Tabla ${tableModel.number}${tableModel.caption ? ': ' + tableModel.caption : ''}</span>
        <div class="table-download-buttons">
          <a href="data:text/csv;charset=utf-8,${encodeURIComponent(BOM + csvContent)}"
             download="tabla-${tableModel.number}.csv"
             class="table-download-btn"
             title="Descargar como CSV">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6"/><path d="M12 18v-4"/><path d="M8 18v-4"/><path d="M16 18v-4"/></svg>
            CSV
          </a>
          <a href="data:application/json;charset=utf-8,${encodeURIComponent(jsonContent)}"
             download="tabla-${tableModel.number}.json"
             class="table-download-btn"
             title="Descargar como JSON">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6"/><path d="M10 15l3 3 3-3"/><path d="M10 9l3-3 3 3"/></svg>
            JSON
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
  
  return $.html();
}

// ========== FUNCIÓN PARA PROCESAR IMÁGENES ==========
function processImages($) {
  $('img').each((i, el) => {
    const $el = $(el);
    const alt = $el.attr('alt') || '';
    const src = $el.attr('src') || '';
    const align = $el.attr('align') || '';
    
    $el.addClass('article-image');
    
    let floatClass = '';
    if (align === 'left' || align === 'right') {
      floatClass = ` float-${align}`;
    }
    
    const figureId = `figure-${figureCounter++}`;
    
    // Envolver la imagen en un enlace para abrir en nueva pestaña
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
}

// ========== FUNCIÓN PARA PROCESAR CÓDIGO ==========
function processCodeBlocks($) {
  let codeIndex = 0;
  
  $('pre code, pre').each((i, el) => {
    const $el = $(el);
    const code = $el.text();
    const lines = code.split('\n');
    const lineCount = lines.length;
    
    // Detectar lenguaje
    let language = '';
    const classAttr = $el.attr('class') || '';
    if (classAttr.includes('language-')) {
      language = classAttr.split('language-')[1].split(' ')[0];
    }
    
    // Generar números de línea
    let lineNumbersHtml = '';
    for (let i = 1; i <= lineCount; i++) {
      lineNumbersHtml += `<span class="code-line-number">${i}</span>`;
    }
    
    // Escapar código
    const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const wrappedLines = lines.map(line => 
      `<span class="line">${line || ' '}</span>`
    ).join('\n');
    
    codeIndex++;
    const codeId = `code-${codeIndex}`;
    
    const codeHtml = `
    <div class="code-block-wrapper" id="${codeId}">
      <div class="code-header">
        <span class="code-language">${language || 'código'}</span>
        <button class="code-copy-btn" onclick="copyCode('${codeId}', this)" title="Copiar código">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span class="copy-text">Copiar</span>
        </button>
      </div>
      <div class="code-block-container">
        <div class="code-line-numbers" aria-hidden="true">
          ${lineNumbersHtml}
        </div>
        <pre class="code-block"><code class="${language ? `language-${language}` : ''}">${wrappedLines}</code></pre>
      </div>
    </div>
    `;
    
    $el.parent().replaceWith(codeHtml);
  });
}

// ========== FUNCIÓN PARA PROCESAR NOTAS AL MARGEN ==========
function processMarginalNotes($) {
  // Buscar notas marginales (pueden tener clase .marginal-note o .sidenote)
  $('.marginal-note, .sidenote').each((i, el) => {
    const $el = $(el);
    const noteId = `marginal-note-${noteCounter++}`;
    const noteText = $el.html();
    
    // Reemplazar con el nuevo formato interactivo
    const noteHtml = `
    <span class="marginal-note-container">
      <button class="marginal-note-toggle" onclick="toggleMarginalNote('${noteId}')" aria-label="Ver nota al margen">
        ${marginalNoteIcon}
      </button>
      <span class="marginal-note-content" id="${noteId}">
        ${noteText}
      </span>
    </span>
    `;
    
    $el.replaceWith(noteHtml);
  });
  
  // También buscar notas al pie estándar
  $('sup, .footnote').each((i, el) => {
    const $el = $(el);
    const noteId = `footnote-${noteCounter++}`;
    const noteText = $el.text();
    
    const noteHtml = `
    <sup>
      <a href="#${noteId}" class="footnote-link" onclick="showFootnote('${noteId}'); return false;">[${noteCounter - 1}]</a>
    </sup>
    <span class="footnote-content" id="${noteId}">
      ${noteText}
      <a href="#" onclick="hideFootnote('${noteId}'); return false;" class="footnote-back">×</a>
    </span>
    `;
    
    $el.replaceWith(noteHtml);
  });
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

// SOLUCIÓN: Modifica generateTOC para que devuelva TANTO el TOC como el HTML modificado
function generateTOC(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const toc = [];
  
  $('h2, h3, h4').each((i, el) => {
    const $el = $(el);
    const level = parseInt(el.tagName[1]);
    const text = $el.text();
    const id = $el.attr('id') || `section-${i}`;
    
    $el.attr('id', id); // ← ¡ESTO ES CRÍTICO! Modifica el HTML
    
    toc.push({
      level,
      id,
      text
    });
  });
  
  return {
    toc,
    html: $.html() // ← Devuelve el HTML modificado con los IDs
  };
}

// ========== FUNCIÓN PRINCIPAL DE PROCESAMIENTO HTML ==========
function processFullHtml(html) {
  if (!html) return '';
  
  const $ = cheerio.load(html, { decodeEntities: false });
  
  // Procesar en el orden correcto
  processMarginalNotes($);
  processCodeBlocks($);
  processImages($);
  
  // Procesar tablas (esto modifica el HTML)
  let processedHtml = $.html();
  const $2 = cheerio.load(processedHtml, { decodeEntities: false });
  processedHtml = processTablesWithDownload($2, processedHtml);
  
  return processedHtml;
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
      resetCounters();
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
  
  // Procesar HTML completo
  const processedHtml = processFullHtml(article.html || '');
  
  // Procesar abstract
  const abstractHtml = processAbstract(article.abstract || '');
  
  // Procesar referencias
  const referencesHtml = processReferences(article.references || '');
  
  // Procesar apéndice
  const appendixHtml = processAppendix(article.appendix || '');
  
  // Procesar nota editorial
  const editorialNoteHtml = article['editorial-note'] || '';
  
  // Generar tabla de contenidos (después de procesar)
 const { toc, html: htmlWithIds } = generateTOC(
    abstractHtml + processedHtml + referencesHtml + appendixHtml
  );
  
  // Procesar autores
  const authorsDisplay = processAuthorsWithIcons(article.author);
  const authorModals = generateAuthorModals(article.author);
  
  // Procesar colaboradores
  const collaboratorsHtml = processCollaborators(article.colaboradores);
  
  // Generar HTML completo
  const htmlContent = generateHtmlTemplate({
    article,
    articleSlug,
    authorsDisplay,
    authorModals,
    collaboratorsHtml,
    processedHtml: htmlWithIds,
    toc,
    abstractHtml,
    processedHtml,
    referencesHtml,
    appendixHtml,
    editorialNoteHtml
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
  abstractHtml,
  processedHtml,
  referencesHtml,
  appendixHtml,
  editorialNoteHtml
}) {
  const hasSpanishTitle = article['name-translated'] && article['name-translated'].trim() !== '';
  const hasOriginalTitle = article['name-original'] && article['name-original'].trim() !== '';
  
  // Título principal (traducido)
  const title = hasSpanishTitle ? article['name-translated'] : article['name-original'];
  
  // Título original (para mostrar como subtítulo)
  const originalTitle = hasOriginalTitle && hasSpanishTitle ? article['name-original'] : '';
  
  // Generar TOC HTML
  const tocHtml = toc.map(item => {
    const indent = item.level > 2 ? '&nbsp;'.repeat((item.level - 2) * 4) : '';
    return `
    <li class="toc-item toc-level-${item.level}">
      <a href="#${item.id}">${indent}${item.text}</a>
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
  
  <!-- Fuentes -->
  <link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+French+Canon:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=es6"></script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  
  <style>
    /* ===== VARIABLES ===== */
    :root {
      --oxford-blue: #002147;
      --british-green: #004225;
      --accent-burgundy: #8b1e3f;
      --cream-bg: #fdfcf8;
      --text-main: #2c2c2c;
      --text-light: #555555;
      --text-muted: #777777;
      --border-color: #e0dcd0;
      --bg-soft: #f5f3ef;
      --code-bg: #1e1e1e;
      --code-text: #d4d4d4;
      --sidebar-width: 280px;
      --content-max-width: 800px;
    }

    /* ===== RESET ===== */
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
      background-color: var(--cream-bg);
      overflow-x: hidden;
      width: 100%;
      position: relative;
    }

    /* ===== HEADER ===== */
    .sd-header {
      background: #fff;
      border-bottom: 1px solid var(--border-color);
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
      border-left: 1px solid #e0e0e0;
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

    .sd-search-wrapper {
      flex: 1;
      max-width: 500px;
    }

    .sd-search-bar {
      display: flex;
      align-items: center;
      background: #f0f2f4;
      border-radius: 4px;
      padding: 6px 12px;
      border: 1px solid transparent;
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
      background: var(--bg-soft);
    }

    .toc-item a.active {
      color: var(--oxford-blue);
      border-left-color: var(--accent-burgundy);
      background: var(--bg-soft);
      font-weight: 500;
    }

    .toc-level-3 a {
      padding-left: 1.5rem;
      font-size: 0.8rem;
    }

    .toc-level-4 a {
      padding-left: 2.5rem;
      font-size: 0.75rem;
    }

    /* ===== CONTENIDO PRINCIPAL ===== */
    .article-container {
      max-width: var(--content-max-width);
      width: 100%;
    }

    /* TÍTULO */
    .seminal-title-container {
      text-align: center;
      padding: 40px 20px;
      border: 1px solid #d4af37;
      margin-bottom: 30px;
      background: rgba(255, 255, 255, 0.5);
      position: relative;
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

    .main-classic-title {
      font-family: 'IM Fell French Canon', serif;
      font-size: 2.8rem;
      line-height: 1.2;
      color: var(--oxford-blue);
      font-style: italic;
      margin: 0;
      font-weight: normal;
    }

    .original-title {
      font-family: 'IM Fell English', serif;
      font-size: 1.3rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
      font-style: italic;
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
      background: var(--cream-bg);
      padding: 0 10px;
      color: #d4af37;
    }

    /* METADATA */
    .archive-metadata {
      display: flex;
      justify-content: center;
      gap: 40px;
      font-family: 'Inter', sans-serif;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 1px;
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      padding: 15px 0;
      margin-top: 20px;
    }

    .meta-label {
      display: block;
      color: var(--text-muted);
      margin-bottom: 5px;
    }

    .meta-value {
      color: var(--oxford-blue);
      font-weight: 600;
    }

    /* AUTORES */
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

    /* COLABORADORES */
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

    /* ACCIONES */
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

    /* ABSTRACT */
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

    .abstract-link {
      color: var(--accent-burgundy);
      text-decoration: none;
      border-bottom: 1px dotted var(--accent-burgundy);
    }

    .abstract-link:hover {
      border-bottom-style: solid;
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

    /* CONTENIDO DEL ARTÍCULO */
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

    /* BLOQUES DE CÓDIGO */
    .code-block-wrapper {
      margin: 2.5rem 0;
      border-radius: 12px;
      background: #1e1e1e;
      box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      font-family: 'JetBrains Mono', monospace;
      border: 1px solid #3c3c3c;
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
      overflow-x: auto;
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
      white-space: pre;
    }

    /* TABLAS */
    .table-download-wrapper {
      margin: 2.5rem 0;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 0.5rem 0;
      border-bottom: 1.5px solid var(--text-main);
      font-family: 'Inter', serif;
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
    }

    .article-table th {
      border-bottom: 1.5px solid var(--text-main);
      padding: 12px 15px;
      text-align: left;
    }

    .article-table td {
      padding: 12px 15px;
      border-bottom: 1px solid #eee;
    }

    .article-table tr:last-child td {
      border-bottom: none;
    }

    /* IMÁGENES */
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

    .article-image {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      display: block;
    }

    .image-caption {
      margin-top: 0.5rem;
      font-size: 0.9rem;
      color: var(--text-muted);
      font-style: italic;
    }

    /* ECUACIONES */
    .MathJax_Display, .math-container {
      margin: 2rem 0 !important;
      padding: 1.5rem 0.5rem;
      background: linear-gradient(to right, transparent, var(--bg-soft), transparent);
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      overflow-x: auto;
      max-width: 100%;
    }

    /* NOTAS MARGINALES - MEJORADO */
    .marginal-note-container {
      display: inline-block;
      position: relative;
    }

    .marginal-note-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--accent-burgundy);
      padding: 2px 4px;
      margin: 0 2px;
      transition: all 0.2s;
    }

    .marginal-note-toggle:hover {
      color: var(--oxford-blue);
      transform: scale(1.1);
    }

    .marginal-note-icon {
      width: 16px;
      height: 16px;
    }

    .marginal-note-content {
      display: none;
      position: fixed;
      bottom: 20px;
      right: 20px;
      max-width: 300px;
      background: white;
      padding: 1rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 1000;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .marginal-note-content.active {
      display: block;
    }

    /* NOTAS AL PIE */
    .footnote-link {
      text-decoration: none;
      color: var(--accent-burgundy);
      font-size: 0.8rem;
    }

    .footnote-content {
      display: none;
      position: fixed;
      bottom: 20px;
      right: 20px;
      max-width: 300px;
      background: white;
      padding: 1rem;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 1000;
    }

    .footnote-content.active {
      display: block;
    }

    .footnote-back {
      display: block;
      text-align: right;
      margin-top: 0.5rem;
      color: var(--oxford-blue);
      text-decoration: none;
      cursor: pointer;
    }

    /* REFERENCIAS */
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

    .reference-item a {
      color: var(--oxford-blue);
      text-decoration: none;
      border-bottom: 1px dotted var(--border-color);
    }

    .reference-item a:hover {
      border-bottom: 1px solid var(--oxford-blue);
    }

    /* APÉNDICE */
    .appendix-section {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 2px solid var(--border-color);
    }

    /* NOTA EDITORIAL */
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

    /* MODAL DE AUTORES */
    .author-modal {
      display: none;
      position: fixed;
      z-index: 2000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      overflow: auto;
      background-color: rgba(0,0,0,0.5);
    }

    .author-modal-content {
      background-color: #fefefe;
      margin: 15% auto;
      padding: 20px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      width: 80%;
      max-width: 600px;
      position: relative;
    }

    .author-modal-close {
      color: #aaa;
      float: right;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
    }

    .author-modal-close:hover {
      color: black;
    }

    .author-dates {
      color: var(--text-muted);
      margin-bottom: 1rem;
    }

    .author-bio {
      line-height: 1.6;
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
      width: 6px;
    }

    .right-sidebar::-webkit-scrollbar-track {
      background: var(--bg-soft);
    }

    .right-sidebar::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 3px;
    }

    .info-tabs {
      background: white;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    .tab-buttons {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-soft);
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
      transition: all 0.2s;
    }

    .tab-button:hover {
      color: var(--oxford-blue);
      background: white;
    }

    .tab-button.active {
      color: var(--oxford-blue);
      border-bottom-color: var(--oxford-blue);
      background: white;
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
      background: white;
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

    /* LISTA DE NOTAS EN SIDEBAR */
    .notes-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .note-item {
      margin-bottom: 0.75rem;
      padding: 0.5rem;
      background: var(--bg-soft);
      border-radius: 4px;
      font-size: 0.85rem;
      border-left: 2px solid var(--accent-burgundy);
    }

    .note-link {
      display: block;
      color: var(--text-main);
      text-decoration: none;
      cursor: pointer;
    }

    .note-link:hover {
      color: var(--oxford-blue);
    }

    .note-number {
      display: inline-block;
      font-weight: bold;
      color: var(--accent-burgundy);
      margin-right: 0.5rem;
    }

    /* ===== FOOTER ===== */
    .footer {
      background: #1a1a1a;
      color: white;
      padding: 60px 20px 30px;
      margin-top: 60px;
      border-top: 1px solid #333;
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
      color: #999;
      text-decoration: none;
      transition: all 0.3s;
    }

    .social-icon:hover {
      color: white;
      transform: translateY(-3px);
    }

    .footer-contact {
      text-align: center;
      margin: 40px 0;
      padding: 20px 0;
      border-top: 1px solid #333;
      border-bottom: 1px solid #333;
    }

    .contact-email {
      color: white;
      text-decoration: none;
      font-size: 1rem;
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
      color: #999;
      text-decoration: none;
      font-size: 0.85rem;
      transition: color 0.3s;
    }

    .footer-nav-link:hover {
      color: white;
    }

    .footer-bottom {
      text-align: center;
      font-size: 9px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 4px;
      padding-top: 30px;
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
    }

    @media (max-width: 900px) {
      .sd-header-top {
        padding: 0.6rem 1.5rem;
      }
      .sd-search-wrapper, .sd-user-nav {
        display: none;
      }
      .sd-mobile-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
    }

    @media (max-width: 600px) {
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
    }
  </style>
</head>
<body>
  <!-- HEADER -->
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
        <form id="search-form" class="sd-search-bar" onsubmit="handleSearch(event)">
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

  <div class="main-wrapper">
    <!-- SIDEBAR IZQUIERDA - TABLA DE CONTENIDOS -->
    <nav class="toc-sidebar">
      <div class="toc-title">CONTENIDO</div>
      <ul class="toc-list" id="toc-list">
        <li class="toc-item toc-level-2">
          <a href="#abstract">Resumen</a>
        </li>
        ${tocHtml}
        ${article.references ? `
        <li class="toc-item toc-level-2">
          <a href="#references">Referencias</a>
        </li>
        ` : ''}
        ${article.appendix ? `
        <li class="toc-item toc-level-2">
          <a href="#appendix">Apéndice</a>
        </li>
        ` : ''}
      </ul>
    </nav>

    <!-- CONTENIDO PRINCIPAL -->
    <main class="article-container">
      <article>
        <!-- TÍTULO SEMINAL -->
        <div class="seminal-title-container">
          <span class="collection-tag">Clásicos de la Ciencia</span>
          <h1 class="main-classic-title">${title}</h1>
          ${originalTitle ? `<div class="original-title">${originalTitle}</div>` : ''}
          <div class="title-separator"></div>
          
          <!-- METADATA DE ARCHIVO -->
          <div class="archive-metadata">
            ${article['original-date'] ? `
            <div class="meta-column">
              <span class="meta-label">Publicado originalmente</span>
              <span class="meta-value">${article['original-date']}</span>
            </div>
            ` : ''}
            <div class="meta-column">
              <span class="meta-label">Identificador</span>
              <span class="meta-value">${article.id || 'CC-0000-0000'}</span>
            </div>
            <div class="meta-column">
              <span class="meta-label">Idioma</span>
              <span class="meta-value">Español (Traducción)</span>
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
            </svg>
            Descargar PDF
          </a>
          <span class="oa-label">
            ${oaSvg}
            Acceso Abierto
          </span>
        </div>
        ` : ''}

        <!-- ABSTRACT -->
        ${abstractHtml ? `
        <section class="abstract-section" id="abstract">
          <h2>Resumen</h2>
          <div class="abstract-text">
            ${abstractHtml}
          </div>
          ${article.keywords && article.keywords.length > 0 ? `
          <div class="keywords">
            ${article.keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
          </div>
          ` : ''}
        </section>
        ` : ''}

        <!-- NOTA EDITORIAL -->
        ${editorialNoteHtml ? `
        <div class="editorial-note" id="editorial-note">
          <h3>Nota de la edición</h3>
          ${editorialNoteHtml}
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
              <button class="copy-btn" onclick="copyText('apa-citation')">Copiar</button>
              <div id="apa-citation" style="margin-top:0.25rem;">
                ${article.author && article.author[0] ? article.author[0].name.split(' ').pop() : 'Autor'}, ${article.author && article.author[0] ? article.author[0].name.split(' ')[0].charAt(0) + '.' : ''}. (${article['original-date'] ? new Date(article['original-date']).getFullYear() : 's.f.'}). ${title}. <em>Clásicos de la Ciencia</em>. ${article.id || ''}.
              </div>
            </div>
            <div class="citation-item">
              <strong>MLA</strong>
              <button class="copy-btn" onclick="copyText('mla-citation')">Copiar</button>
              <div id="mla-citation" style="margin-top:0.25rem;">
                ${article.author && article.author[0] ? article.author[0].name : 'Autor'}. "${title}." <em>Clásicos de la Ciencia</em>, ${article['original-date'] || 's.f.'}, ${article.id || ''}.
              </div>
            </div>
            <div class="citation-item">
              <strong>Chicago</strong>
              <button class="copy-btn" onclick="copyText('chicago-citation')">Copiar</button>
              <div id="chicago-citation" style="margin-top:0.25rem;">
                ${article.author && article.author[0] ? article.author[0].name : 'Autor'}. "${title}." <em>Clásicos de la Ciencia</em> (${article['original-date'] || 's.f.'}): ${article.id || ''}.
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
            <span class="metadata-label">Fecha original</span>
            <span class="metadata-value">${article['original-date'] || 'N/A'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Traducción</span>
            <span class="metadata-value">${article.date || formatDate(new Date())}</span>
          </div>
          ${article.keywords && article.keywords.length > 0 ? `
          <h4 style="margin-top:1rem;">Palabras clave</h4>
          <div class="keywords">
            ${article.keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
          </div>
          ` : ''}
        </div>
        
        <!-- NOTAS - AQUÍ VAN LAS NOTAS MARGINALES -->
        <div id="notes-panel" class="tab-panel">
          <h4>Notas del artículo</h4>
          <div id="notes-list-container" class="notes-list">
            <!-- Las notas se insertarán dinámicamente con JavaScript -->
            <p>Cargando notas...</p>
          </div>
        </div>
      </div>
    </aside>
  </div>

  <!-- FOOTER -->
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
    // ========== FUNCIONES GLOBALES ==========
    
    // Función para manejar la búsqueda
    function handleSearch(e) {
      e.preventDefault();
      const query = document.getElementById('search-input').value.trim();
      if (query) {
        window.location.href = '/search?q=' + encodeURIComponent(query);
      }
    }

    // Función para menú móvil
    function toggleMobileMenu() {
      alert('Versión móvil en desarrollo');
    }

    // ========== FUNCIONES PARA MODALES DE AUTORES ==========
    function openAuthorModal(authorId) {
      const modal = document.getElementById('author-modal-' + authorId);
      if (modal) {
        modal.style.display = 'block';
      }
    }

    function closeAuthorModal(authorId) {
      const modal = document.getElementById('author-modal-' + authorId);
      if (modal) {
        modal.style.display = 'none';
      }
    }

    // Cerrar modal al hacer clic fuera
    window.onclick = function(event) {
      if (event.target.classList.contains('author-modal')) {
        event.target.style.display = 'none';
      }
    }

    // ========== FUNCIONES PARA NOTAS ==========
    function toggleMarginalNote(noteId) {
      const note = document.getElementById(noteId);
      if (note) {
        note.classList.toggle('active');
        
        // Cerrar al hacer clic fuera
        if (note.classList.contains('active')) {
          setTimeout(() => {
            function closeHandler(e) {
              if (!note.contains(e.target) && !e.target.closest('.marginal-note-toggle')) {
                note.classList.remove('active');
                document.removeEventListener('click', closeHandler);
              }
            }
            document.addEventListener('click', closeHandler);
          }, 100);
        }
      }
    }

    function showFootnote(noteId) {
      const note = document.getElementById(noteId);
      if (note) {
        note.classList.add('active');
      }
    }

    function hideFootnote(noteId) {
      const note = document.getElementById(noteId);
      if (note) {
        note.classList.remove('active');
      }
    }

    // ========== FUNCIONES PARA PESTAÑAS ==========
    function switchTab(tabName) {
      // Ocultar todos los paneles
      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
      });
      
      // Desactivar todos los botones
      document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Activar el panel seleccionado
      const panel = document.getElementById(tabName + '-panel');
      if (panel) {
        panel.classList.add('active');
      }
      
      // Activar el botón clickeado
      if (event && event.target) {
        event.target.classList.add('active');
      }
    }

    // ========== FUNCIONES PARA COPIAR TEXTO ==========
    function copyText(elementId) {
      const element = document.getElementById(elementId);
      if (!element) return;
      
      const text = element.innerText || element.textContent;
      
      navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        const originalText = btn.innerText;
        btn.innerText = '✓ Copiado';
        setTimeout(() => {
          btn.innerText = originalText;
        }, 2000);
      }).catch(err => {
        console.error('Error copying text:', err);
        alert('No se pudo copiar el texto');
      });
    }

    // ========== FUNCIÓN PARA COPIAR CÓDIGO ==========
    function copyCode(codeId, btn) {
      const codeElement = document.getElementById(codeId);
      if (!codeElement) return;
      
      const code = codeElement.querySelector('code')?.innerText || codeElement.innerText;
      
      navigator.clipboard.writeText(code).then(() => {
        const originalText = btn.querySelector('.copy-text')?.innerText || 'Copiar';
        const copyText = btn.querySelector('.copy-text');
        if (copyText) {
          copyText.innerText = '✓ Copiado';
          setTimeout(() => {
            copyText.innerText = originalText;
          }, 2000);
        }
      }).catch(err => {
        console.error('Error copying code:', err);
        alert('No se pudo copiar el código');
      });
    }

    // ========== COLECCIONAR NOTAS PARA EL SIDEBAR ==========
    function collectNotes() {
      const notesList = document.getElementById('notes-list-container');
      if (!notesList) return;
      
      const notes = [];
      
      // Buscar notas marginales
      document.querySelectorAll('.marginal-note-content[id^="marginal-note-"]').forEach((note, index) => {
        notes.push({
          id: note.id,
          number: index + 1,
          text: note.innerText || note.textContent,
          type: 'marginal'
        });
      });
      
      // Buscar notas al pie
      document.querySelectorAll('.footnote-content[id^="footnote-"]').forEach((note, index) => {
        notes.push({
          id: note.id,
          number: notes.length + index + 1,
          text: note.innerText || note.textContent,
          type: 'footnote'
        });
      });
      
      if (notes.length === 0) {
        notesList.innerHTML = '<p>No hay notas en este artículo.</p>';
        return;
      }
      
      let html = '';
      notes.forEach(note => {
        const shortText = note.text.substring(0, 100);
        html += \`
          <div class="note-item">
            <a href="#\${note.id}" class="note-link" onclick="document.getElementById('\${note.id}').classList.add('active'); return false;">
              <span class="note-number">[\${note.number}]</span>
              \${shortText}\${note.text.length > 100 ? '...' : ''}
            </a>
          </div>
        \`;
      });
      
      notesList.innerHTML = html;
    }

    // ========== RESALTAR SECCIÓN ACTIVA EN TOC ==========
    function setupTOCHighlight() {
      const sections = document.querySelectorAll('h2[id], h3[id], h4[id], #abstract, #references, #appendix');
      const tocLinks = document.querySelectorAll('.toc-item a');
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            tocLinks.forEach(link => {
              link.classList.remove('active');
              if (link.getAttribute('href') === '#' + entry.target.id) {
                link.classList.add('active');
              }
            });
          }
        });
      }, { threshold: 0.3, rootMargin: '-80px 0px -80px 0px' });
      
      sections.forEach(section => {
        if (section.id) observer.observe(section);
      });
    }

    // ========== NAVEGACIÓN SUAVE ==========
    function setupSmoothScroll() {
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
          const href = this.getAttribute('href');
          if (href === '#') return;
          
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });
    }

    // ========== HIGHLIGHT JS ==========
    function setupHighlightJS() {
      if (window.hljs) {
        document.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block);
        });
      }
    }

    // ========== MATHJAX ==========
    function setupMathJax() {
      if (window.MathJax) {
        MathJax.typesetPromise();
      }
    }

    // ========== INICIALIZACIÓN ==========
    document.addEventListener('DOMContentLoaded', function() {
      setupTOCHighlight();
      setupSmoothScroll();
      setupHighlightJS();
      setupMathJax();
      collectNotes();
      
      // Forzar que los enlaces del TOC tengan el comportamiento suave
      document.querySelectorAll('.toc-item a').forEach(link => {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          const href = this.getAttribute('href');
          if (href && href !== '#') {
            const target = document.querySelector(href);
            if (target) {
              target.scrollIntoView({ behavior: 'smooth' });
            }
          }
        });
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