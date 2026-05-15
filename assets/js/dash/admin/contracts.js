import { listContractsAdmin, getContractDownloadUrl } from "/assets/js/contracts/lib/api.js";

const statusEl = document.getElementById("status");
const bodyEl = document.getElementById("contractsBody");
const refreshBtn = document.getElementById("refreshBtn");
const statusFilter = document.getElementById("statusFilter");

function fmtDate(value) {
  if (!value) return "-";
  const rawTs = value?.seconds ?? value?._seconds ?? null;
  const ts = Number(rawTs);
  const date = ts ? new Date(ts * 1000) : new Date(value);
  return isNaN(date.getTime()) ? "-" : date.toLocaleString("fr-FR");
}

function rowTemplate(item) {
  return `
    <tr>
      <td>${fmtDate(item.createdAt)}</td>
      <td>${item.customerName || "-"}<br><small>${item.customerEmail || ""}</small></td>
      <td>${item.trackName || "-"}</td>
      <td><span class="tag">${item.signatureStatus || "pending"}</span></td>
      <td>
        <button data-id="${item.id}" data-kind="generated">Draft</button>
        <button data-id="${item.id}" data-kind="signed">Signé</button>
      </td>
    </tr>
  `;
}

async function load() {
  statusEl.textContent = "Chargement...";
  bodyEl.innerHTML = "";
  try {
    const filter = statusFilter.value;
    const rows = await listContractsAdmin(filter === "all" ? null : filter);
    if (!rows.length) {
      statusEl.textContent = "Aucun contrat.";
      return;
    }
    statusEl.textContent = `${rows.length} contrat(s)`;
    bodyEl.innerHTML = rows.map(rowTemplate).join("");
  } catch (error) {
    statusEl.textContent = `Erreur: ${error.message || error}`;
  }
}

bodyEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  const contractId = button.dataset.id;
  const kind = button.dataset.kind;
  try {
    const data = await getContractDownloadUrl(contractId, kind);
    if (data?.url) window.open(data.url, "_blank", "noopener");
  } catch (error) {
    alert(`Erreur ouverture: ${error.message || error}`);
  }
});

refreshBtn.addEventListener("click", load);
statusFilter.addEventListener("change", load);

load();
