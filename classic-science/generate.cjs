// ===================================================
// GENERADOR DE ARTÍCULOS PARA COLECCIÓN "CLÁSICOS DE LA CIENCIA"
// Ruta: /colections/classic-science/generate.js
// Basado en generador original de la revista, adaptado
// para publicación continua con estética de edición crítica.
// ===================================================

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// ========== CONFIGURACIÓN ==========
const METADATA_JSON = path.join(__dirname, 'metadata.json');
const OUTPUT_HTML_DIR = path.join(__dirname, 'articles'); // Los artículos se guardan en una subcarpeta
const DOMAIN = 'https://www.revistacienciasestudiantes.com';
const JOURNAL_NAME_ES = 'Revista Nacional de las Ciencias para Estudiantes';
const LOGO_ES = 'https://www.revistacienciasestudiantes.com/assets/logo.png';
const COLLECTION_NAME = 'Clásicos de la Ciencia';
const COLLECTION_ID_PREFIX = 'CC';

// ========== MODELO INTERMEDIO DE TABLA (AST) ==========
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
    rows: table.rows.map(row => row.map(cell => cell.text)),
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
        obj[key] = row[idx]?.text || '';
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
    latex.push(`\\caption{${escapeLaTeX(table.caption)}}`);
  }
  
  latex.push(`\\label{tab:${table.number}}`);
  latex.push(`\\begin{tabular}{|${alignment.split('').join('|')}|}`);
  latex.push('\\hline');

  if (table.headers.length) {
    const headerLine = table.headers
      .map(h => escapeLaTeX(h.text))
      .join(' & ');
    latex.push(headerLine + ' \\\\');
    latex.push('\\hline');
  }

  table.rows.forEach(row => {
    const rowLine = row
      .map(cell => escapeLaTeX(cell.text))
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

function resetTableCounter() {
  tableCounter = 1;
}
// ========== UTILIDADES ==========
function generateSlug(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDateEs(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('es-CL', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  } catch (e) {
    return dateStr;
  }
}

function formatAuthorForCitation(author) {
  let authorName = '';
  if (typeof author === 'string') {
    authorName = author;
  } else if (author && author.name) {
    authorName = author.name;
  } else if (author && (author.firstName || author.lastName)) {
    authorName = `${author.firstName || ''} ${author.lastName || ''}`.trim();
  } else {
    return '';
  }
  
  const parts = authorName.trim().split(' ');
  if (parts.length >= 2) {
    const apellido = parts.pop();
    const nombre = parts.join(' ');
    return `${apellido}, ${nombre}`;
  }
  return authorName;
}

function formatAuthorsDisplay(authors) {
  let authorsArray = [];
  if (typeof authors === 'string') {
    authorsArray = authors.split(';').map(a => a.trim()).filter(Boolean);
  } else if (Array.isArray(authors)) {
    authorsArray = authors.map(a => {
      if (typeof a === 'string') return a;
      if (a.name) return a.name;
      if (a.firstName || a.lastName) return `${a.firstName || ''} ${a.lastName || ''}`.trim();
      return '';
    }).filter(Boolean);
  }
  
  if (!authorsArray.length) return 'Autor desconocido';
  if (authorsArray.length === 1) {
    return authorsArray[0];
  } else if (authorsArray.length === 2) {
    return `${authorsArray[0]} y ${authorsArray[1]}`;
  } else {
    return authorsArray.slice(0, -1).join(', ') + ` y ` + authorsArray[authorsArray.length - 1];
  }
}

function formatKeywords(keywords) {
  if (!keywords) return [];
  if (Array.isArray(keywords)) return keywords;
  if (typeof keywords === 'string') return keywords.split(',').map(k => k.trim());
  return [];
}

// ========== CARGA DE TEAM.JSON ==========
let authorMap = {};
let authorBySlugMap = {};
let authorByNameMap = {};

async function loadTeamData() {
  try {
    const TEAM_JSON_URL = 'https://www.revistacienciasestudiantes.com/team/Team.json';
    console.log(`🌐 Cargando equipo desde: ${TEAM_JSON_URL}`);

    const response = await fetch(TEAM_JSON_URL);
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}`);
    }

    const team = await response.json();

    if (Array.isArray(team)) {
      team.forEach(member => {
        if (member.uid) {
          authorMap[member.uid] = {
            uid: member.uid,
            displayName: member.displayName,
            slug: member.slug,
            orcid: member.orcid,
            email: member.publicEmail,
            firstName: member.firstName,
            lastName: member.lastName,
            institution: member.institution,
            imageUrl: member.imageUrl
          };
        }
        if (member.slug) {
          authorBySlugMap[member.slug] = authorMap[member.uid];
        }
        if (member.displayName) {
          authorByNameMap[member.displayName] = authorMap[member.uid];
        }
      });
      console.log(`📚 ${Object.keys(authorMap).length} autores cargados.`);
    }
  } catch (e) {
    console.log('⚠️ No se pudo cargar Team.json, los autores no tendrán enlaces. Error:', e.message);
  }
}

function findAuthorInfo(author, articleAuthorId = null) {
  if (!author) return null;
  
  let displayName = '';
  if (typeof author === 'string') {
    displayName = author;
  } else if (author.name) {
    displayName = author.name;
  } else if (author.firstName || author.lastName) {
    displayName = `${author.firstName || ''} ${author.lastName || ''}`.trim();
  } else {
    return null;
  }
  
  if (articleAuthorId && authorMap[articleAuthorId]) {
    return authorMap[articleAuthorId];
  }
  if (authorByNameMap[displayName]) {
    return authorByNameMap[displayName];
  }
  if (author.slug && authorBySlugMap[author.slug]) {
    return authorBySlugMap[author.slug];
  }
  
  return null;
}

function processAuthorsWithIcons(authors, article = null) {
  if (!authors) return 'Autor desconocido';
  
  let authorsArray = [];
  if (typeof authors === 'string') {
    authorsArray = authors.split(';').map(name => ({ name: name.trim() }));
  } else if (Array.isArray(authors)) {
    authorsArray = authors;
  }
  
  const authorElements = authorsArray.map((author, index) => {
    let displayName = '';
    if (typeof author === 'string') {
      displayName = author;
    } else if (author.name) {
      displayName = author.name;
    } else if (author.firstName || author.lastName) {
      displayName = `${author.firstName || ''} ${author.lastName || ''}`.trim();
    } else {
      displayName = 'Autor';
    }
    
    const articleAuthorId = article && article.authorIds ? article.authorIds[index] : null;
    const authorInfo = findAuthorInfo(author, articleAuthorId);
    
    let authorHtml = '';
    
    if (authorInfo && authorInfo.slug) {
      authorHtml += `<a href="/team/${authorInfo.slug}.html" class="author-link" data-author-uid="${authorInfo.uid || ''}">${displayName}</a>`;
    } else {
      authorHtml += `<span class="author-name">${displayName}</span>`;
    }
    
    const icons = [];
    const orcid = (authorInfo && authorInfo.orcid) || author.orcid;
    if (orcid && orcid.trim() !== '') {
      icons.push(`<a href="https://orcid.org/${orcid}" target="_blank" rel="noopener noreferrer" class="author-icon orcid-icon" title="ORCID">${orcidSvg}</a>`);
    }
    const email = (authorInfo && authorInfo.email) || author.email || author.publicEmail;
    if (email && email.trim() !== '') {
      icons.push(`<a href="mailto:${email}" class="author-icon email-icon" title="Email">${emailSvg}</a>`);
    }
    
    if (icons.length > 0) {
      authorHtml += `<span class="author-icons">${icons.join('')}</span>`;
    }
    
    return authorHtml;
  });
  
  return authorElements.join('<span class="author-separator">, </span>');
}

function processCollaboratorsWithIcons(collaborators) {
    if (!collaborators || !collaborators.length) return '';
    
    const collabElements = collaborators.map(collab => {
        let collabHtml = '';
        let displayName = collab.name || 'Colaborador';
        
        if (collab.link) {
            collabHtml += `<a href="${collab.link}" class="collaborator-link"`;
            if (collab.uid) collabHtml += ` data-collab-uid="${collab.uid}"`;
            collabHtml += `>${displayName}</a>`;
        } else {
            collabHtml += `<span class="collaborator-name">${displayName}</span>`;
        }
        
        const icons = [];
        if (collab.orcid) {
            icons.push(`<a href="https://orcid.org/${collab.orcid}" target="_blank" rel="noopener noreferrer" class="collaborator-icon orcid-icon" title="ORCID">${orcidSvg}</a>`);
        }
        if (collab.email) {
            icons.push(`<a href="mailto:${collab.email}" class="collaborator-icon email-icon" title="Email">${emailSvg}</a>`);
        }
        
        if (icons.length > 0) {
            collabHtml += `<span class="collaborator-icons">${icons.join('')}</span>`;
        }
        
        return collabHtml;
    });
    
    return collabElements.join('<span class="collaborator-separator">, </span>');
}


// ========== ICONOS SVG ==========
const oaSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="72" height="72" viewBox="90 50 500 260" style="vertical-align: middle;">
  <g transform="matrix(1.25 0 0 -1.25 0 360)">
    <defs><path id="a" d="M-90-36h900v360H-90z"/></defs>
    <clipPath id="b"><use xlink:href="#a" overflow="visible"/></clipPath>
    <g clip-path="url(#b)">
      <path d="M720-3H0v294.285h720V-3z" fill="#fff"/>
      <path d="M262.883 200.896v-8.846h25.938v8.846c0 21.412 17.421 38.831 38.831 38.831 21.409 0 38.829-17.419 38.829-38.831v-63.985h25.939v63.985c0 35.713-29.056 64.769-64.768 64.769-35.711 0-64.769-29.056-64.769-64.769M349.153 99.568c0-11.816-9.58-21.396-21.399-21.396-11.818 0-21.398 9.58-21.398 21.396 0 11.823 9.58 21.404 21.398 21.404 11.819 0 21.399-9.581 21.399-21.404" fill="#f68212"/>
      <path d="M277.068 99.799c0 27.811 22.627 50.436 50.438 50.436 27.809 0 50.433-22.625 50.433-50.436 0-27.809-22.624-50.438-50.433-50.438-27.811.001-50.438 22.63-50.438 50.438m-25.938 0c0-42.109 34.265-76.373 76.375-76.373 42.111 0 76.373 34.265 76.373 76.373 0 42.113-34.262 76.375-76.373 76.375-42.11 0-76.375-34.262-76.375-76.375" fill="#f68212"/>
    </g>
  </g>
</svg>`;

const orcidSvg = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" width="16" height="16"> <circle cx="128" cy="128" r="120" fill="#A6CE39"/> <g fill="#FFFFFF"> <rect x="71" y="78" width="17" height="102"/> <circle cx="79.5" cy="56" r="11"/> <path d="M103 78 v102 h41.5 c28.2 0 51-22.8 51-51 s-22.8-51-51-51 H103 zm17 17 h24.5 c18.8 0 34 15.2 34 34 s-15.2 34-34 34 H120 V95 z" fill-rule="evenodd"/> </g> </svg>`;

const emailSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; color: #005a7d;">
  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
  <polyline points="22,6 12,13 2,6"></polyline>
</svg>`;

const ccLogoSvg = `<img src="https://bibliotecas.ucn.cl/wp-content/uploads/2025/04/by1.png" alt="CC BY 4.0" style="height: 1.2em; width: auto; vertical-align: middle;">`;

// ========== SOCIAL ICONS Y LINKS ==========
const socialIcons = {
  instagram: `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
  youtube: `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  tiktok: `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
  spotify: `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.508 17.308c-.221.362-.689.473-1.05.252-2.983-1.823-6.738-2.237-11.162-1.226-.411.094-.823-.162-.917-.573-.094-.412.162-.823.573-.917 4.847-1.108 8.995-.635 12.305 1.386.36.221.472.69.251 1.05zm1.47-3.255c-.278.452-.865.594-1.317.316-3.414-2.098-8.62-2.706-12.657-1.479-.508.154-1.04-.136-1.194-.644-.154-.508.136-1.04.644-1.194 4.613-1.399 10.366-.719 14.256 1.67.452.278.594.865.316 1.317zm.126-3.374C14.653 7.64 7.29 7.394 3.05 8.681c-.604.183-1.246-.166-1.429-.77-.183-.604.166-1.246.77-1.429 4.883-1.482 13.014-1.201 18.238 1.902.544.323.72 1.034.397 1.578-.323.544-1.034.72-1.578.397z"/></svg>`
};

const socialLinks = {
  instagram: 'https://www.instagram.com/revistanacionalcienciae',
  youtube: 'https://www.youtube.com/@RevistaNacionaldelasCienciaspa',
  tiktok: 'https://www.tiktok.com/@revistacienciaestudiante',
  spotify: 'https://open.spotify.com/show/6amsgUkNXgUTD219XpuqOe?si=LPzCNpusQjSLGBq_pPrVTw'
};

// ========== FUNCIÓN PARA PROCESAR TABLAS CON BOTONES DE DESCARGA ==========
function processTablesWithDownload($, html) {
  if (!html) return html;
  resetTableCounter();
  let tableIndex = 0;
  
  $('table').each((i, el) => {
    const $el = $(el);
    tableIndex++;
    const tableId = `table-${tableIndex}`;
    $el.attr('id', tableId);
    $el.addClass('article-table');
    
    const tableModel = parseTable($, $el);
    
    const csvContent = tableToCSV(tableModel);
    const jsonContent = tableToJSON(tableModel);
    const latexContent = tableToLaTeX(tableModel);
    const xmlContent = tableToXML(tableModel);
    const tableHtml = $.html($el);
    const BOM = '\uFEFF';
    
    const tableWrapper = `
    <div class="table-download-wrapper" id="${tableId}">
      <div class="table-header">
        <span class="table-label">Tabla ${tableIndex}</span>
        <div class="table-download-buttons">
          <a href="data:text/csv;charset=utf-8,${encodeURIComponent(BOM + csvContent)}" download="tabla-${tableIndex}.csv" class="table-download-btn" title="Descargar como CSV"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h6"/><path d="M9 16h6"/><path d="M9 8h3"/><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><span>CSV</span></a>
          <a href="data:application/vnd.ms-excel;charset=utf-8,${encodeURIComponent(BOM + tableHtml)}" download="tabla-${tableIndex}.xls" class="table-download-btn" title="Descargar como Excel"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg><span>Excel</span></a>
          <a href="data:application/json;charset=utf-8,${encodeURIComponent(jsonContent)}" download="tabla-${tableIndex}.json" class="table-download-btn" title="Descargar como JSON"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 20c-1.5 0-2.5-1-2.5-2.5v-3.5c0-1-1-1.5-2-1.5s-2-.5-2-1.5v-1c0-1 1-1.5 2-1.5s2-.5 2-1.5v-3.5c0-1.5 1-2.5 2.5-2.5"/><path d="M14 4c1.5 0 2.5 1 2.5 2.5v3.5c0 1 1 1.5 2 1.5s2 .5 2 1.5v1c0 1-1 1.5-2 1.5s-2 .5-2 1.5v3.5c0 1.5-1 2.5-2.5 2.5"/></svg><span>JSON</span></a>
          <a href="data:text/plain;charset=utf-8,${encodeURIComponent(latexContent)}" download="tabla-${tableIndex}.tex" class="table-download-btn" title="Descargar como LaTeX"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 4h-12l7 8-7 8h12"/></svg><span>LaTeX</span></a>
          <a href="data:application/xml;charset=utf-8,${encodeURIComponent(xmlContent)}" download="tabla-${tableIndex}.xml" class="table-download-btn" title="Descargar como XML"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg><span>XML</span></a>
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

// ========== FUNCIÓN PARA PROCESAR CÓDIGOS EN HTML ==========
function processCodeBlocks(html) {
  if (!html) return html;
  
  const $ = cheerio.load(html, { decodeEntities: false });
  let codeIndex = 0;
  
  $('pre code, pre').each((i, el) => {
    const $el = $(el);
    const code = $el.text();
    const lines = code.split('\n');
    const lineCount = lines.length;
    
    let language = '';
    const classAttr = $el.attr('class') || '';
    if (classAttr.includes('language-')) {
      language = classAttr.split('language-')[1].split(' ')[0];
    } else if (classAttr.includes('lang-')) {
      language = classAttr.split('lang-')[1].split(' ')[0];
    }
    
    let lineNumbersHtml = '';
    for (let i = 1; i <= lineCount; i++) {
      lineNumbersHtml += `<span class="code-line-number">${i}</span>`;
    }
    
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
      <button class="code-copy-btn" onclick="copyCode('${codeId}', this)" title="Copiar código (Ctrl+C)">
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
      <pre class="code-block ${language ? `language-${language}` : ''}"><code class="${language ? `language-${language}` : ''}">${wrappedLines}</code></pre>
    </div>
  </div>
`;
    
    $el.parent().replaceWith(codeHtml);
  });
  
  let processedHtml = $.html();
  
  const $2 = cheerio.load(processedHtml, { decodeEntities: false });
  processedHtml = processTablesWithDownload($2, processedHtml);
  
  const $3 = cheerio.load(processedHtml, { decodeEntities: false });
  
  let figureIndex = 0;
  $3('img').each((i, el) => {
    const $el = $3(el);
    const alt = $el.attr('alt') || '';
    const src = $el.attr('src') || '';
    const style = $el.attr('style') || '';
    const align = $el.attr('align') || '';
    
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      $el.attr('src', src);
    }
    
    $el.addClass('article-image');
    
    let floatClass = '';
    if (style.includes('float: left') || align === 'left') {
      floatClass = ' float-left';
    } else if (style.includes('float: right') || align === 'right') {
      floatClass = ' float-right';
    }
    
    figureIndex++;
    const figureId = `figure-${figureIndex}`;
    
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
  
  let equationIndex = 0;
  $3('.MathJax_Display, .math-container').each((i, el) => {
    const $el = $3(el);
    equationIndex++;
    const equationId = `equation-${equationIndex}`;
    $el.attr('id', equationId);
  });
  
  return $3.html();
}

// ========== FUNCIÓN PRINCIPAL DE GENERACIÓN ==========
async function generateAll() {
  console.log('🚀 Iniciando generación de la colección "Clásicos de la Ciencia"...');
  
  try {
    if (!fs.existsSync(METADATA_JSON)) {
      throw new Error(`No se encuentra ${METADATA_JSON}`);
    }
    
    const metadata = JSON.parse(fs.readFileSync(METADATA_JSON, 'utf8'));
    
    if (!metadata.articles || !Array.isArray(metadata.articles)) {
        throw new Error('El metadata.json debe contener un array "articles".');
    }
    console.log(`📄 ${metadata.articles.length} artículos cargados desde metadata.`);

    if (!fs.existsSync(OUTPUT_HTML_DIR)) {
      fs.mkdirSync(OUTPUT_HTML_DIR, { recursive: true });
    }

    await loadTeamData();

    for (const article of metadata.articles) {
      await generateArticleHtml(article);
    }

    generateIndexes(metadata.articles);

    console.log('🎉 ¡Colección generada con éxito!');
    
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

async function generateArticleHtml(article) {
  
  // --- Extracción de datos del artículo ---
  const id = article.id || `${COLLECTION_ID_PREFIX}-0000-0000`;
  const nameOriginal = article['name-original'] || 'Título Original';
  const nameTranslated = article['name-translated'] || nameOriginal;
  const authors = article.author || [];
  const collaborators = article.colaboradores || [];
  const editors = article.editor || [];
  const abstract = article.abstract || '';
  const keywords = formatKeywords(article.keywords);
  const source = article.source || [];
  const htmlContent = article.html || '';
  const references = article.references || [];
  const number = article.number || 1;
  const appendix = article.appendix || [];
  const editorialNote = article['editorial-note'] || '';
  const pdfUrl = article['pdf-url'] || '#';
  const originalDate = article['original-date'] || 'Desconocida';
  const articleDate = article.date || new Date().toISOString().split('T')[0];
  
  const slug = generateSlug(nameOriginal);
  const fileName = `${id.toLowerCase()}.html`; // Ej: cc-2024-0001.html

  // --- Procesamiento de contenido ---
  const processedHtml = processCodeBlocks(htmlContent);
  
  // --- Construcción de metadatos para autores, editores, etc. ---
  const authorsDisplay = processAuthorsWithIcons(authors, article);
  const collaboratorsDisplay = processCollaboratorsWithIcons(collaborators);
  
  const authorsListForMeta = authors.map(a => formatAuthorForCitation(a)).join('; ');
  
  const keywordsString = keywords.join(', ');
  
  // --- Construcción del HTML final ---
  const htmlOutput = generateHtmlTemplate({
    id,
    nameOriginal,
    nameTranslated,
    authorsDisplay,
    collaboratorsDisplay,
    editors,
    abstract,
    keywords,
    keywordsString,
    source,
    processedHtml,
    references,
    number,
    appendix,
    editorialNote,
    pdfUrl,
    originalDate,
    articleDate,
    slug,
    fileName,
    authorsListForMeta,
    collectionName: COLLECTION_NAME
  });

  const filePath = path.join(OUTPUT_HTML_DIR, fileName);
  fs.writeFileSync(filePath, htmlOutput, 'utf8');
  console.log(`✅ Generado: ${filePath} (${nameOriginal})`);
}

function generateHtmlTemplate({
  id,
  nameOriginal,
  nameTranslated,
  authorsDisplay,
  collaboratorsDisplay,
  editors,
  abstract,
  keywords,
  keywordsString,
  source,
  processedHtml,
  references,
  number,
  appendix,
  editorialNote,
  pdfUrl,
  originalDate,
  articleDate,
  slug,
  fileName,
  authorsListForMeta,
  collectionName
}) {
  
  // --- Textos fijos en español ---
  const texts = {
    backToCollections: '← Volver a la colección',
    backToHome: 'Volver al inicio',
    abstract: 'Resumen',
    keywords: 'Palabras clave',
    source: 'Fuente original',
    howToCite: 'Cómo citar este clásico',
    editorialNote: 'Nota del equipo editorial',
    references: 'Referencias',
    appendix: 'Apéndices',
    collaborators: 'Colaboradores',
    editors: 'Editores',
    downloadPDF: 'Descargar PDF',
    originalPublication: 'Publicación original',
    collectionDate: 'Fecha de esta edición',
    license: 'Licencia',
    contact: 'Contacto'
  };
  
  // --- Construcción de la cita sugerida ---
  const suggestedCitation = `${authorsListForMeta}. "${nameOriginal}." Traducción y notas del equipo editorial. *${collectionName}*, no. ${number}, ${new Date(articleDate).getFullYear()}. ${DOMAIN}/colections/classic-science/articles/${fileName}`;

  // --- Construcción de las referencias HTML ---
  const referencesHtml = references.map(ref => {
      if (ref.link) {
          return `<div class="reference-item"><a href="${ref.link}" target="_blank" rel="noopener">${ref.citation}</a></div>`;
      } else {
          return `<div class="reference-item">${ref.citation}</div>`;
      }
  }).join('');

  const sourceHtml = source.map(src => {
      if (src.link) {
          return `<div class="source-item"><a href="${src.link}" target="_blank" rel="noopener">${src.citation}</a></div>`;
      } else {
          return `<div class="source-item">${src.citation}</div>`;
      }
  }).join('');

  const appendixHtml = appendix.map(ap => {
      return `<section id="appendix-${ap.id}" class="appendix-section"><h3>Apéndice ${ap.id}</h3><div class="appendix-content">${ap.html}</div></section>`;
  }).join('');

  // --- HTML de editores ---
  const editorsHtml = editors.map(ed => {
      let html = `<span class="editor-name">${ed.name}</span>`;
      const links = [];
      if (ed.website) links.push(`<a href="${ed.website}" target="_blank" rel="noopener">🌐</a>`);
      if (ed.orcid) links.push(`<a href="https://orcid.org/${ed.orcid}" target="_blank" rel="noopener">${orcidSvg}</a>`);
      if (ed.email) links.push(`<a href="mailto:${ed.email}">${emailSvg}</a>`);
      if (links.length) html += `<span class="editor-icons">${links.join(' ')}</span>`;
      return html;
  }).join(', ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Metadatos DC y de citación -->
  <meta name="citation_title" content="${nameOriginal.replace(/"/g, '&quot;')}">
  <meta name="citation_author" content="${authorsListForMeta.replace(/"/g, '&quot;')}">
  <meta name="citation_publication_date" content="${articleDate}">
  <meta name="citation_journal_title" content="${collectionName}">
  <meta name="citation_issn" content="3087-2839">
  <meta name="citation_issue" content="${number}">
  <meta name="citation_pdf_url" content="${pdfUrl}">
  <meta name="citation_abstract" content="${abstract.replace(/"/g, '&quot;').substring(0, 500)}">
  <meta name="citation_keywords" content="${keywordsString}">
  <meta name="citation_language" content="es">
  <meta name="DC.title" content="${nameOriginal}">
  <meta name="DC.creator" content="${authorsListForMeta}">
  <meta name="DC.date" content="${articleDate}">
  <meta name="DC.type" content="Text">
  <meta name="DC.format" content="text/html">
  <meta name="DC.identifier" content="${id}">
  <meta name="DC.source" content="${collectionName}">
  <meta name="DC.language" content="es">
  
  <title>${nameOriginal} – ${collectionName}</title>
  
  <!-- Fuentes: IM Fell + Inter -->
  <link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+French+Canon:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=es6"></script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  
  <style>
    /* ===== VARIABLES Y RESET ===== */
    :root {
      --oxford-blue: #002147;
      --british-racing-green: #004225;
      --burdeos: #800020;
      --cream: #fdfcf8;
      --text-main: #2c2c2c;
      --text-light: #555555;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
      --bg-soft: #f8f9fa;
      --bg-hover: #f3f4f6;
      --accent: #c2410c;
      --code-bg: #1a1b26;
      --code-text: #cfc9c2;
      --code-border: #2c2e3a;
      --code-header-bg: #232530;
      --sidebar-width: 260px;
      --aside-width: 280px;
      --content-max-width: 900px;
    }
    
    * {
      max-width: 100vw;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      overflow-x: hidden;
      width: 100%;
      position: relative;
      font-family: 'IM Fell English', 'Crimson Text', 'Libre Baskerville', serif;
      line-height: 1.7;
      color: var(--text-main);
      background-color: var(--cream);
      margin: 0;
    }
    
    /* ===== HEADER (conservado de la revista) ===== */
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
    
    /* Search Bar */
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
    
    .sd-search-bar:focus-within {
      background: #fff;
      border-color: var(--oxford-blue);
    }
    
    .sd-search-icon {
      color: var(--text-muted);
      margin-right: 8px;
    }
    
    .sd-search-bar input {
      border: none;
      background: transparent;
      width: 100%;
      font-family: 'Inter', sans-serif;
      font-size: 0.85rem;
      outline: none;
    }
    
    /* User Nav */
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
    
    .sd-nav-link:hover {
      color: var(--oxford-blue);
    }
    
    /* Mobile controls */
    .sd-mobile-controls {
      display: none;
      align-items: center;
      gap: 0.5rem;
    }
    
    .sd-mobile-search-btn,
    .sd-mobile-menu-btn {
      display: none;
      background: none;
      border: none;
      padding: 8px;
      cursor: pointer;
      color: var(--text-main);
    }
    
    /* ===== MAIN LAYOUT: DOS COLUMNAS CON NOTAS MARGINALES ===== */
    .main-wrapper {
      max-width: 1400px;
      margin: 2rem auto;
      display: grid;
      grid-template-columns: 1fr 300px; /* Texto y notas marginales */
      gap: 3rem;
      padding: 0 2rem;
    }
    
    /* Contenido principal */
    .article-container {
      max-width: var(--content-max-width);
      width: 100%;
      min-width: 0; /* Para evitar overflow */
    }
    
    /* Barra lateral derecha para notas marginales */
    .marginalia-sidebar {
      position: sticky;
      top: 100px;
      height: fit-content;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
      font-family: 'Inter', sans-serif;
      font-size: 0.85rem;
      line-height: 1.5;
      color: var(--text-light);
      border-left: 1px solid var(--border-color);
      padding-left: 1.5rem;
    }
    
    .marginalia-sidebar .note {
      margin-bottom: 1.5rem;
      padding-left: 0.5rem;
      border-left: 2px solid var(--burdeos);
      opacity: 0.8;
      transition: opacity 0.3s;
    }
    
    .marginalia-sidebar .note:hover {
      opacity: 1;
    }
    
    .marginalia-sidebar .note-label {
      font-weight: 600;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--oxford-blue);
      display: block;
      margin-bottom: 0.25rem;
    }
    
    /* ===== TÍTULO SEMINAL (estilo portada antigua) ===== */
    .seminal-title-container {
      text-align: center;
      padding: 40px 20px 30px 20px;
      margin-bottom: 30px;
      border: 1px solid #d4af37;
      background-image: radial-gradient(circle at 10% 20%, rgba(0,33,71,0.02) 0%, transparent 20%);
    }
    
    .collection-tag {
      font-family: 'IM Fell English', serif;
      font-variant: small-caps;
      letter-spacing: 0.3em;
      color: var(--burdeos);
      font-size: 0.9rem;
      display: block;
      margin-bottom: 15px;
    }
    
    .main-classic-title {
      font-family: 'IM Fell French Canon', serif;
      font-size: 3.2rem;
      line-height: 1.1;
      color: var(--oxford-blue);
      font-style: italic;
      margin: 0;
      font-weight: normal;
    }
    
    .title-separator {
      width: 150px;
      height: 2px;
      background: var(--oxford-blue);
      margin: 25px auto;
      position: relative;
    }
    
    .title-separator::after {
      content: "✦";
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--cream);
      padding: 0 15px;
      color: #d4af37;
      font-size: 1.2rem;
    }
    
    .subtitle-classic {
      font-family: 'IM Fell English', serif;
      font-size: 1.4rem;
      font-weight: normal;
      color: #444;
      max-width: 600px;
      margin: 0 auto;
    }
    
    /* ===== FICHA DE ARCHIVO (metadatos) ===== */
    .archive-metadata {
      display: flex;
      justify-content: center;
      gap: 40px;
      font-family: 'Inter', sans-serif;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.15em;
      border-top: 1px solid #eee;
      border-bottom: 1px solid #eee;
      padding: 15px 0;
      margin: 20px 0 30px 0;
      flex-wrap: wrap;
    }
    
    .meta-label {
      display: block;
      color: #999;
      margin-bottom: 5px;
    }
    
    .meta-value {
      color: var(--text-main);
      font-weight: 600;
    }
    
    /* ===== AUTORES, EDITORES, COLABORADORES ===== */
    .authors-section, .editors-section, .collaborators-section {
      font-family: 'Inter', sans-serif;
      margin: 1.5rem 0;
    }
    
    .section-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      display: block;
      margin-bottom: 0.3rem;
    }
    
    .authors-list, .editors-list, .collaborators-list {
      font-size: 1.1rem;
      font-weight: 500;
      line-height: 1.5;
    }
    
    .author-link, .collaborator-link {
      color: var(--oxford-blue);
      text-decoration: none;
      border-bottom: 1px dotted transparent;
      transition: border-color 0.2s;
    }
    
    .author-link:hover, .collaborator-link:hover {
      border-bottom-color: var(--oxford-blue);
    }
    
    .author-icons, .collaborator-icons, .editor-icons {
      display: inline-flex;
      gap: 0.3rem;
      margin-left: 0.3rem;
      vertical-align: middle;
    }
    
    .author-icon, .collaborator-icon {
      display: inline-block;
      opacity: 0.7;
    }
    
    .author-icon:hover, .collaborator-icon:hover {
      opacity: 1;
    }
    
    .author-separator, .collaborator-separator {
      color: var(--text-light);
      margin: 0 0.2rem;
    }
    
    /* ===== ABSTRACT Y CONTENIDO ===== */
    .abstract-container {
      margin: 2rem 0;
      padding: 1.5rem 2rem;
      background: rgba(0,33,71,0.02);
      border-left: 3px solid var(--oxford-blue);
      font-style: italic;
    }
    
    .abstract-text {
      font-size: 1.1rem;
    }
    
    .article-content {
      font-size: 1.1rem;
      line-height: 1.7;
      text-align: justify;
    }
    
    .article-content p {
      margin-bottom: 1.2rem;
    }
    
    /* Drop cap para la primera letra */
    .article-content p:first-of-type::first-letter {
      float: left;
      font-family: 'IM Fell French Canon', serif;
      font-size: 4.5rem;
      line-height: 0.8;
      padding-right: 8px;
      color: var(--oxford-blue);
    }
    
    /* ===== KEYWORDS ===== */
    .keywords-container {
      margin: 1.5rem 0;
    }
    
    .keyword-tag {
      display: inline-block;
      font-family: 'Inter', sans-serif;
      font-size: 0.7rem;
      background: white;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      color: var(--text-light);
      margin-right: 0.5rem;
      margin-bottom: 0.5rem;
    }
    
    /* ===== BLOQUES DE CÓDIGO ===== */
    .code-block-wrapper {
      margin: 2.5rem 0;
      border-radius: 8px;
      background: #1e1e1e;
      box-shadow: 0 10px 25px -8px rgba(0,0,0,0.4);
      overflow: hidden;
      font-family: 'JetBrains Mono', monospace;
    }
    
    .code-header {
      background: #2d2d2d;
      padding: 0.6rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #3c3c3c;
      color: #ccc;
      font-family: 'Inter', sans-serif;
    }
    
    .code-language {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      color: #9cdcfe;
    }
    
    .code-copy-btn {
      background: #3c3c3c;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 0.3rem 0.8rem;
      font-size: 0.7rem;
      cursor: pointer;
      color: #ccc;
      transition: all 0.2s;
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
      user-select: none;
      border-right: 1px solid #3c3c3c;
      min-width: 45px;
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
      white-space: pre;
      font-family: 'JetBrains Mono', monospace;
    }
    
    /* ===== TABLAS ESTILO ACADÉMICO ===== */
    .table-download-wrapper {
      margin: 2.5rem 0;
    }
    
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 0.5rem 0;
      border-bottom: 1.5px solid var(--text-main);
      font-family: 'Inter', sans-serif;
    }
    
    .table-label {
      font-weight: 700;
      font-size: 0.9rem;
    }
    
    .table-download-buttons {
      display: flex;
      gap: 1rem;
    }
    
    .table-download-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 0.7rem;
      text-decoration: none;
      border-bottom: 1px solid transparent;
    }
    
    .table-download-btn:hover {
      color: var(--oxford-blue);
      border-bottom-color: var(--oxford-blue);
    }
    
    .table-wrapper {
      overflow-x: auto;
      margin: 1rem 0;
      border-top: 2px solid var(--oxford-blue);
      border-bottom: 2px solid var(--oxford-blue);
    }
    
    .article-table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Inter', sans-serif;
      font-size: 0.9rem;
    }
    
    .article-table th {
      border-bottom: 1px solid var(--oxford-blue);
      padding: 10px 15px;
      text-align: left;
      font-weight: 600;
    }
    
    .article-table td {
      padding: 8px 15px;
      border-bottom: 1px solid #eee;
    }
    
    .article-table tr:last-child td {
      border-bottom: none;
    }
    
    /* ===== IMÁGENES ===== */
    .image-link {
      display: inline-block;
      cursor: zoom-in;
    }
    
    .image-link::after {
      content: "⤢";
      position: absolute;
      bottom: 10px;
      right: 10px;
      background: rgba(255,255,255,0.8);
      width: 24px;
      height: 24px;
      border-radius: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
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
    }
    
    .image-caption {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-muted);
      font-style: italic;
    }
    
    /* ===== NOTAS, REFERENCIAS, APÉNDICES ===== */
    h2 {
      font-family: 'IM Fell English', serif;
      font-size: 1.8rem;
      font-weight: normal;
      margin: 3rem 0 1.5rem 0;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }
    
    h3 {
      font-family: 'IM Fell English', serif;
      font-size: 1.4rem;
      font-weight: normal;
      margin: 2rem 0 1rem 0;
    }
    
    .references-list, .source-list {
      margin: 1.5rem 0;
    }
    
    .reference-item, .source-item {
      margin-bottom: 1rem;
      padding-left: 1.5rem;
      text-indent: -1.5rem;
      font-size: 0.95rem;
    }
    
    .reference-item a, .source-item a {
      color: var(--oxford-blue);
      text-decoration: none;
      border-bottom: 1px dotted #ccc;
    }
    
    .appendix-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: var(--bg-soft);
      border-left: 3px solid var(--british-racing-green);
    }
    
    .editorial-note {
      margin: 2rem 0;
      padding: 1.5rem;
      background: rgba(128,0,32,0.05);
      border: 1px solid var(--burdeos);
      border-radius: 4px;
      font-style: italic;
    }
    
    .editorial-note::before {
      content: "✎ Nota del editor";
      display: block;
      font-family: 'Inter', sans-serif;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--burdeos);
      margin-bottom: 0.5rem;
    }
    
    /* ===== PDF BUTTON ===== */
    .pdf-action {
      margin: 2rem 0;
      text-align: center;
    }
    
    .btn-pdf {
      background: var(--oxford-blue);
      color: white;
      padding: 0.8rem 2rem;
      border-radius: 40px;
      text-decoration: none;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--oxford-blue);
      transition: all 0.2s;
    }
    
    .btn-pdf:hover {
      background: transparent;
      color: var(--oxford-blue);
    }
    
    /* ===== FOOTER (igual que en la revista) ===== */
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
    
    .social-icon svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }
    
    .social-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    
    .social-icon:hover .social-label {
      opacity: 1;
    }
    
    .footer-contact {
      text-align: center;
      margin: 40px 0;
      padding: 20px 0;
      border-top: 1px solid #333;
      border-bottom: 1px solid #333;
    }
    
    .contact-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: #666;
      display: block;
      margin-bottom: 10px;
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
    
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin: 20px 0;
      font-size: 9px;
    }
    
    .footer-links a {
      color: #777;
      text-decoration: none;
    }
    
    /* ===== MOBILE ===== */
    @media (max-width: 1100px) {
      .main-wrapper {
        grid-template-columns: 1fr;
      }
      .marginalia-sidebar {
        display: none;
      }
    }
    
    @media (max-width: 900px) {
      .sd-search-wrapper, .sd-user-nav {
        display: none;
      }
      .sd-mobile-controls {
        display: flex;
      }
      .sd-mobile-search-btn,
      .sd-mobile-menu-btn {
        display: block;
      }
      .main-classic-title {
        font-size: 2.4rem;
      }
    }
    
    @media (max-width: 600px) {
      .sd-header-top {
        padding: 0.5rem 1rem;
      }
      .sd-logo-img {
        display: none;
      }
      .sd-journal-titles {
        border-left: none;
        padding-left: 0;
      }
      .sd-journal-name {
        font-size: 0.8rem;
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
      .archive-metadata {
        flex-direction: column;
        gap: 10px;
        align-items: center;
      }
    }
  </style>
</head>
<body>
  
  <!-- ===== HEADER (idéntico al de la revista) ===== -->
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
          <input type="text" id="search-input" placeholder="Buscar artículos, autores..." aria-label="Buscar">
        </form>
      </div>
      
      <div class="sd-user-nav">
        <a href="/submit" class="sd-nav-link">Envíos</a>
        <a href="/faq" class="sd-nav-link">Ayuda</a>
        <a href="/login" class="sd-nav-link sd-account">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
          Mi cuenta
        </a>
      </div>
      
      <div class="sd-mobile-controls">
        <button class="sd-mobile-search-btn" onclick="toggleMobileSearch()" aria-label="Buscar">
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        </button>
        <button class="sd-mobile-menu-btn" onclick="toggleMobileMenu()" aria-label="Menú">
          <svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
        </button>
      </div>
    </div>
  </header>
  
  <!-- Overlay y menú móvil (simplificado para el ejemplo) -->
  <div class="sd-mobile-overlay" id="mobileOverlay" onclick="closeMobileMenu()" style="display:none;"></div>
  <div class="sd-mobile-menu" id="mobileMenu" style="display:none;">
    <!-- contenido del menú móvil, similar al de la revista -->
  </div>
  
  <!-- ===== CONTENEDOR PRINCIPAL ===== -->
  <div class="main-wrapper">
    <!-- Columna principal: el artículo -->
    <main class="article-container">
      
      <!-- Título estilo portada antigua -->
      <div class="seminal-title-container">
        <span class="collection-tag">Ex Classicis Scientiarum</span>
        <h1 class="main-classic-title">${nameOriginal}</h1>
        ${nameTranslated && nameTranslated !== nameOriginal ? `
        <div class="title-separator"></div>
        <h2 class="subtitle-classic">${nameTranslated}</h2>
        ` : ''}
      </div>
      
      <!-- Ficha de archivo -->
      <div class="archive-metadata">
        <div class="meta-column">
          <span class="meta-label">Identificador</span>
          <span class="meta-value">${id}</span>
        </div>
        <div class="meta-column">
          <span class="meta-label">Publicación original</span>
          <span class="meta-value">${originalDate}</span>
        </div>
        <div class="meta-column">
          <span class="meta-label">Esta edición</span>
          <span class="meta-value">${formatDateEs(articleDate)}</span>
        </div>
      </div>
      
      <!-- Autores -->
      ${authorsDisplay ? `
      <div class="authors-section">
        <span class="section-label">Autoría</span>
        <div class="authors-list">${authorsDisplay}</div>
      </div>
      ` : ''}
      
      <!-- Editores -->
      ${editorsHtml ? `
      <div class="editors-section">
        <span class="section-label">Edición académica</span>
        <div class="editors-list">${editorsHtml}</div>
      </div>
      ` : ''}
      
      <!-- Colaboradores -->
      ${collaboratorsDisplay ? `
      <div class="collaborators-section">
        <span class="section-label">Colaboradores</span>
        <div class="collaborators-list">${collaboratorsDisplay}</div>
      </div>
      ` : ''}
      
      <!-- Resumen -->
      <div class="abstract-container">
        <div class="abstract-text">${abstract}</div>
      </div>
      
      <!-- Palabras clave -->
      ${keywords.length ? `
      <div class="keywords-container">
        <span class="section-label">${texts.keywords}</span>
        <div>
          ${keywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
        </div>
      </div>
      ` : ''}
      
      <!-- Fuente original (si existe) -->
      ${sourceHtml ? `
      <section id="source">
        <h2>${texts.source}</h2>
        <div class="source-list">${sourceHtml}</div>
      </section>
      ` : ''}
      
      <!-- Nota editorial (si existe) -->
      ${editorialNote ? `
      <div class="editorial-note">${editorialNote}</div>
      ` : ''}
      
      <!-- Cuerpo del artículo (con HTML procesado) -->
      <section id="full-text" class="article-content">
        ${processedHtml || '<p>El texto completo estará disponible próximamente.</p>'}
      </section>
      
      <!-- Apéndices -->
      ${appendixHtml ? `
      <section id="appendix">
        <h2>${texts.appendix}</h2>
        ${appendixHtml}
      </section>
      ` : ''}
      
      <!-- Referencias -->
      ${referencesHtml ? `
      <section id="references">
        <h2>${texts.references}</h2>
        <div class="references-list">${referencesHtml}</div>
      </section>
      ` : ''}
      
      <!-- Cómo citar -->
      <section id="how-to-cite">
        <h2>${texts.howToCite}</h2>
        <div class="citation-box" style="background:var(--bg-soft); padding:1.5rem; border-radius:4px; font-family:'Inter',sans-serif; font-size:0.9rem;">
          ${suggestedCitation}
          <button class="copy-btn" onclick="copyRichText('citation-text', event)" style="margin-left:1rem; background:none; border:1px solid var(--oxford-blue); padding:0.2rem 0.8rem; border-radius:4px; cursor:pointer;">Copiar</button>
          <div id="citation-text" style="display:none;">${suggestedCitation.replace(/\*/g, '')}</div>
        </div>
      </section>
      
      <!-- Botón PDF -->
      <div class="pdf-action">
        <a href="${pdfUrl}" target="_blank" rel="noopener" class="btn-pdf">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
          </svg>
          ${texts.downloadPDF}
        </a>
      </div>
      
    </main>
    
    <!-- Barra lateral para notas marginales (solo visible en desktop) -->
    <aside class="marginalia-sidebar">
      <!-- Las notas se pueden insertar dinámicamente vía JS, o aquí en el HTML si se generan desde el JSON -->
      <div class="note">
        <span class="note-label">Nota I</span>
        <p>Las notas marginales permiten comentarios sin interrumpir la lectura, al estilo de las ediciones Tufte.</p>
      </div>
      <div class="note">
        <span class="note-label">Nota II</span>
        <p>En una implementación completa, estas notas se extraerían del contenido HTML mediante marcadores especiales como <code>&lt;span class="marginalia"&gt;</code>.</p>
      </div>
    </aside>
  </div>
  
  <!-- ===== FOOTER (idéntico al de la revista) ===== -->
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
        <span class="contact-label">${texts.contact}</span>
        <a href="mailto:contact@revistacienciasestudiantes.com" class="contact-email">contact@revistacienciasestudiantes.com</a>
      </div>

      <div class="footer-nav-links">
        <a href="/colections/classic-science/" class="footer-nav-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>
          ${texts.backToCollections}
        </a>
        <a href="/" class="footer-nav-link">
          ${texts.backToHome}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>
        </a>
      </div>

      <div class="footer-bottom">
        <div class="footer-links">
          <a href="/privacy.html">Privacidad</a> | <a href="/terms.html">Términos</a> | <a href="/credits.html">Créditos</a>
        </div>
        <p>© ${new Date().getFullYear()} ${JOURNAL_NAME_ES} · ISSN 3087-2839</p>
        <p style="margin-top:1rem; font-size:8px;">Colección ${collectionName} · Publicación continua · ${id}</p>
      </div>
    </div>
  </footer>
  
  <script>
    // Funciones auxiliares (copiar, menú móvil, highlight, etc.)
    document.addEventListener('DOMContentLoaded', function() {
      if (window.hljs) {
        document.querySelectorAll('pre code').forEach((block) => {
          hljs.highlightElement(block);
        });
      }
    });
    
    function copyRichText(id, event) {
      const element = document.getElementById(id);
      if (!element) return;
      const text = element.innerText || element.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        const originalText = btn.innerText;
        btn.innerText = '✓ Copiado';
        setTimeout(() => { btn.innerText = originalText; }, 2000);
      });
    }
    
    function copyCode(codeId, btn) {
      const element = document.getElementById(codeId);
      if (!element) return;
      const code = element.querySelector('code')?.innerText || element.innerText;
      navigator.clipboard.writeText(code).then(() => {
        const originalText = btn.innerText;
        btn.innerHTML = '✓ Copiado';
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
      });
    }
    
    // Funciones de menú móvil (implementación básica)
    window.toggleMobileMenu = function() {
      alert('Menú móvil - implementar según necesidad');
    };
    window.toggleMobileSearch = function() {
      alert('Búsqueda móvil - implementar según necesidad');
    };
    window.closeMobileMenu = function() {};
  </script>
  
</body>
</html>`;
}

// ========== GENERACIÓN DE ÍNDICES ==========
function generateIndexes(articles) {
  // Ordenar por fecha de edición (más reciente primero)
  const sortedArticles = [...articles].sort((a, b) => 
    new Date(b.date || 0) - new Date(a.date || 0)
  );

  // Índice principal de la colección
  const indexContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${COLLECTION_NAME} · Archivo</title>
  <link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+French+Canon:ital@0;1&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --oxford-blue: #002147;
      --cream: #fdfcf8;
      --text-main: #2c2c2c;
      --border: #e4e4e4;
    }
    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--cream);
      color: var(--text-main);
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    .top-bar {
      background: white;
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .collection-title {
      font-family: 'IM Fell French Canon', serif;
      font-size: 1.8rem;
      color: var(--oxford-blue);
      font-style: italic;
      margin: 0;
    }
    .main-wrapper {
      max-width: 1000px;
      margin: 3rem auto;
      padding: 0 2rem;
    }
    .intro {
      font-size: 1.1rem;
      margin-bottom: 3rem;
      border-left: 3px solid var(--oxford-blue);
      padding-left: 1.5rem;
    }
    .articles-grid {
      display: grid;
      gap: 2rem;
    }
    .article-card {
      background: white;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      border-radius: 4px;
      transition: transform 0.2s, box-shadow 0.2s;
      border: 1px solid var(--border);
    }
    .article-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0,33,71,0.1);
    }
    .article-id {
      font-family: 'IM Fell English', serif;
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }
    .article-title {
      font-family: 'IM Fell French Canon', serif;
      font-size: 1.8rem;
      color: var(--oxford-blue);
      margin: 0 0 1rem 0;
      line-height: 1.2;
    }
    .article-authors {
      font-size: 1rem;
      color: #555;
      margin-bottom: 1rem;
    }
    .article-meta {
      font-size: 0.9rem;
      color: #777;
      display: flex;
      gap: 1.5rem;
      margin: 1rem 0;
    }
    .btn {
      display: inline-block;
      background: var(--oxford-blue);
      color: white;
      padding: 0.6rem 1.5rem;
      text-decoration: none;
      border-radius: 40px;
      font-size: 0.9rem;
      font-weight: 500;
      border: 1px solid var(--oxford-blue);
      transition: all 0.2s;
    }
    .btn:hover {
      background: transparent;
      color: var(--oxford-blue);
    }
    footer {
      text-align: center;
      padding: 4rem 2rem;
      color: #777;
      font-size: 0.9rem;
      border-top: 1px solid var(--border);
      margin-top: 4rem;
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="collection-title">${COLLECTION_NAME}</div>
    <a href="/" style="color:var(--oxford-blue); text-decoration:none; font-size:0.9rem;">← Volver a la revista</a>
  </div>
  <div class="main-wrapper">
    <div class="intro">
      <p>Ediciones académicas de textos fundamentales de la ciencia. Traducciones realizadas por el equipo editorial, con aparato crítico y notas. Publicación continua.</p>
    </div>
    
    <div class="articles-grid">
      ${sortedArticles.map(article => {
        const id = article.id || 'CC-0000-0000';
        const title = article['name-original'] || 'Título';
        const authors = article.author || [];
        const authorsDisplay = formatAuthorsDisplay(authors);
        const date = article.date ? new Date(article.date).toLocaleDateString('es-CL', { year: 'numeric', month: 'long' }) : 'Fecha desconocida';
        const fileName = `${id.toLowerCase()}.html`;
        return `
        <div class="article-card">
          <div class="article-id">${id}</div>
          <h2 class="article-title">${title}</h2>
          <div class="article-authors">${authorsDisplay}</div>
          <div class="article-meta">
            <span>📅 ${date}</span>
            <span>📄 ${article.number || '—'}</span>
          </div>
          <a href="articles/${fileName}" class="btn">Leer el clásico →</a>
        </div>
      `}).join('')}
    </div>
  </div>
  <footer>
    <p>© ${new Date().getFullYear()} ${JOURNAL_NAME_ES} · Colección ${COLLECTION_NAME} · Publicación continua · ISSN 3087-2839</p>
  </footer>
</body>
</html>`;

  const indexPath = path.join(__dirname, 'index.html');
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log(`✅ Índice de colección: ${indexPath}`);
}

// ========== EJECUCIÓN ==========
generateAll();