import { MONTH_NAMES } from "./constants";
import { formatHours } from "./payroll";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toAscii(value = "") {
  return String(value).replace(/[^\x20-\x7E]/g, " ");
}

function escapePdfText(value = "") {
  return toAscii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function fileSafeLabel(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  const url = window.URL.createObjectURL(blob);

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1000);
}

function wrapLine(line, limit = 92) {
  const words = toAscii(line).split(" ");
  const rows = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= limit) {
      currentLine = nextLine;
      return;
    }

    if (currentLine) {
      rows.push(currentLine);
      currentLine = word;
      return;
    }

    rows.push(word.slice(0, limit));
    currentLine = word.slice(limit);
  });

  if (currentLine) {
    rows.push(currentLine);
  }

  return rows.length > 0 ? rows : [""];
}

function buildPdfDocument(lines) {
  const linesPerPage = 48;
  const pages = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];

  pages.forEach((pageLines) => {
    const commands = ["BT", "/F1 11 Tf", "14 TL", "50 790 Td"];

    pageLines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        commands.push("T*");
      }

      commands.push(`(${escapePdfText(line)}) Tj`);
    });

    commands.push("ET");

    const content = commands.join("\n");
    const contentId = addObject(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );

    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Count ${
    pageIds.length
  } /Kids [${pageIds.map((pageId) => `${pageId} 0 R`).join(" ")}] >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((objectBody, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
  });

  const xrefStart = pdf.length;

  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return pdf;
}

function buildReportLines({ technicianName, jobs, summary, month, year }) {
  const periodLabel = `${MONTH_NAMES[month]} ${year}`;
  const lines = [
    `M's Fleet Service Payroll Report`,
    `${technicianName} | ${periodLabel}`,
    "",
    `Regular hours: ${formatHours(summary?.regularHours || 0)}`,
    `After hours: ${formatHours(summary?.afterHours || 0)}`,
    `Total hours: ${formatHours(summary?.totalHours || 0)}`,
    `Jobs in report: ${summary?.jobCount || 0}`,
    ""
  ];

  if (!jobs.length) {
    lines.push("No jobs were recorded for this technician in the selected period.");
    return lines;
  }

  jobs.forEach((job, index) => {
    lines.push(
      `${index + 1}. ${job.date} | ${job.customer || "No customer"} | ${
        job.location || "No location"
      }`
    );
    lines.push(
      `   Dispatch ${job.dispatchTime || "--:--"} | Arrival ${
        job.arrivalTime || "--:--"
      } | Finished ${job.finishedTime || "--:--"}`
    );
    lines.push(
      `   Regular ${formatHours(job.payroll?.regularHours || 0)}h | After ${formatHours(
        job.payroll?.afterHours || 0
      )}h | Total ${formatHours(job.payroll?.totalHours || 0)}h`
    );
    lines.push(
      `   ETA to job ${job.etaToHours || 0}h ${job.etaToMinutes || 0}m | ETA from job ${
        job.etaFromHours || 0
      }h ${job.etaFromMinutes || 0}m (${job.etaFromDestination === "next_job" ? "Next job" : "Home"})`
    );

    if (job.issue) {
      lines.push(`   Issue: ${job.issue}`);
    }

    if (job.payroll?.holidayName) {
      lines.push(`   Holiday rule applied: ${job.payroll.holidayName}`);
    }

    lines.push("");
  });

  return lines;
}

export function downloadExcelReport({ technicianName, jobs, summary, month, year }) {
  const periodLabel = `${MONTH_NAMES[month]} ${year}`;
  const filename = `${fileSafeLabel(technicianName)}-${year}-${String(
    month + 1
  ).padStart(2, "0")}.xls`;

  const rows = jobs
    .map(
      (job) => `
        <tr>
          <td>${escapeHtml(job.date)}</td>
          <td>${escapeHtml(job.customer)}</td>
          <td>${escapeHtml(job.location)}</td>
          <td>${escapeHtml(job.issue)}</td>
          <td>${escapeHtml(job.dispatchTime)}</td>
          <td>${escapeHtml(job.arrivalTime)}</td>
          <td>${escapeHtml(job.finishedTime)}</td>
          <td>${escapeHtml(`${job.etaToHours || 0}h ${job.etaToMinutes || 0}m`)}</td>
          <td>${escapeHtml(
            `${job.etaFromHours || 0}h ${job.etaFromMinutes || 0}m`
          )}</td>
          <td>${escapeHtml(job.etaFromDestination === "next_job" ? "Next Job" : "Home")}</td>
          <td>${formatHours(job.payroll?.regularHours || 0)}</td>
          <td>${formatHours(job.payroll?.afterHours || 0)}</td>
          <td>${formatHours(job.payroll?.totalHours || 0)}</td>
        </tr>
      `
    )
    .join("");

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Calibri, sans-serif; padding: 24px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #d4d9e2; padding: 8px; text-align: left; }
          th { background: #13263e; color: #ffffff; }
          .meta { margin-bottom: 16px; }
          .summary td { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="meta">
          <h2>M's Fleet Service Payroll Report</h2>
          <div>Technician: ${escapeHtml(technicianName)}</div>
          <div>Period: ${escapeHtml(periodLabel)}</div>
        </div>

        <table class="summary">
          <tr>
            <td>Regular Hours</td>
            <td>${formatHours(summary?.regularHours || 0)}</td>
            <td>After Hours</td>
            <td>${formatHours(summary?.afterHours || 0)}</td>
            <td>Total Hours</td>
            <td>${formatHours(summary?.totalHours || 0)}</td>
          </tr>
        </table>

        <br />

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Location</th>
              <th>Issue</th>
              <th>Dispatch</th>
              <th>Arrival</th>
              <th>Finished</th>
              <th>ETA To</th>
              <th>ETA From</th>
              <th>Destination</th>
              <th>Regular Hours</th>
              <th>After Hours</th>
              <th>Total Hours</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;

  downloadBlob(
    new Blob(["\ufeff", html], {
      type: "application/vnd.ms-excel;charset=utf-8;"
    }),
    filename
  );
}

export function downloadPdfReport({ technicianName, jobs, summary, month, year }) {
  const filename = `${fileSafeLabel(technicianName)}-${year}-${String(
    month + 1
  ).padStart(2, "0")}.pdf`;
  const lines = buildReportLines({ technicianName, jobs, summary, month, year })
    .flatMap((line) => wrapLine(line));
  const pdfDocument = buildPdfDocument(lines);

  downloadBlob(new Blob([pdfDocument], { type: "application/pdf" }), filename);
}
