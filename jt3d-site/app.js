
const API_BASE = localStorage.getItem("JT3D_API_BASE") || "http://jt3d-aii.onrender.com";

const form = document.querySelector("#generatorForm");
const fileInput = document.querySelector("#images");
const statusBox = document.querySelector("#status");
const progressBar = document.querySelector("#progressBar");
const resultBox = document.querySelector("#result");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const files = [...fileInput.files];
    if (!files.length) return alert("Envie pelo menos uma foto.");
    if (files.length > 4) return alert("Envie no máximo 4 fotos.");

    const fd = new FormData();
    files.forEach(f => fd.append("images", f));
    fd.append("style", document.querySelector("#style")?.value || "realista");
    fd.append("instructions", document.querySelector("#instructions")?.value || "");
    fd.append("use_multiview", String(files.length >= 2));

    statusBox.hidden = false;
    resultBox.hidden = true;
    statusBox.textContent = "Enviando fotos para a IA JT3D...";
    if (progressBar) progressBar.value = 5;

    try {
      const r = await fetch(`${API_BASE}/api/gerar-3d`, { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Erro ao iniciar geração.");

      statusBox.textContent = "IA Tripo processando o modelo...";
      poll(data.task_id);
    } catch (err) {
      statusBox.textContent = "Erro: " + err.message;
    }
  });
}

async function poll(taskId) {
  const r = await fetch(`${API_BASE}/api/tarefa/${taskId}`);
  const data = await r.json();

  if (!r.ok) {
    statusBox.textContent = "Erro: " + (data.detail || "falha ao consultar tarefa");
    return;
  }

  if (progressBar) progressBar.value = Number(data.progress || 0);
  statusBox.textContent = `Processando: ${data.progress || 0}%`;

  if (data.status === "success") {
    statusBox.textContent = "Modelo 3D pronto!";
    resultBox.hidden = false;
    resultBox.innerHTML = `
      <div class="result-card">
        <h3>Seu modelo JT3D está pronto</h3>
        ${data.preview_url ? `<img src="${data.preview_url}" alt="Prévia do modelo" style="max-width:320px;border-radius:16px">` : ""}
        ${data.model_url ? `<p><a class="btn" href="${data.model_url}" target="_blank" rel="noopener">Abrir modelo 3D</a></p>` : ""}
        <small>O link de download da Tripo pode expirar; o backend deve copiar o arquivo para seu armazenamento antes de oferecer download permanente.</small>
      </div>`;
    return;
  }

  if (data.status === "failed" || data.status === "cancelled") {
    statusBox.textContent = "A geração não foi concluída.";
    return;
  }

  setTimeout(() => poll(taskId), 2500);
}
