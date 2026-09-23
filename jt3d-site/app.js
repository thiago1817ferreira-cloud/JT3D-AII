
const API_BASE = "https://jt3d-aii.onrender.com";

const fileInput = document.querySelector("#photos");
const styleInput = document.querySelector("#style");
const formatInput = document.querySelector("#format");
const promptInput = document.querySelector("#prompt");
const generateButton = document.querySelector("#generate");

const statusBox = document.querySelector("#status");
const thumbsBox = document.querySelector("#thumbs");
const progressBar = document.querySelector("#progressBar");

const viewer = document.querySelector("#viewer");
const resultBox = document.querySelector("#result");

let selectedFiles = [];

/* =========================================================
SELEÇÃO DAS FOTOS
========================================================= */

if (fileInput) {
fileInput.addEventListener("change", () => {
selectedFiles = [...fileInput.files];

if (selectedFiles.length > 8) {
  alert("Você pode enviar no máximo 8 fotos.");
  selectedFiles = selectedFiles.slice(0, 8);
}

mostrarMiniaturas();

});
}

/* =========================================================
MINIATURAS
========================================================= */

function mostrarMiniaturas() {

if (!thumbsBox) return;

thumbsBox.innerHTML = "";

selectedFiles.forEach((file) => {

const reader = new FileReader();

reader.onload = (event) => {

  const img = document.createElement("img");

  img.src = event.target.result;
  img.alt = file.name;

  img.style.width = "90px";
  img.style.height = "90px";
  img.style.objectFit = "cover";
  img.style.borderRadius = "12px";
  img.style.margin = "5px";

  thumbsBox.appendChild(img);
};

reader.readAsDataURL(file);

});
}

/* =========================================================
BOTÃO GERAR
========================================================= */

if (generateButton) {

generateButton.addEventListener("click", async () => {

if (!selectedFiles.length) {
  alert("Envie pelo menos uma foto.");
  return;
}

if (selectedFiles.length > 8) {
  alert("Envie no máximo 8 fotos.");
  return;
}

const formData = new FormData();

selectedFiles.forEach((file) => {
  formData.append("images", file);
});

formData.append(
  "style",
  styleInput?.value || "realista"
);

formData.append(
  "instructions",
  promptInput?.value || ""
);

formData.append(
  "format",
  formatInput?.value || "stl"
);

formData.append(
  "use_multiview",
  String(selectedFiles.length >= 2)
);


/* -----------------------------------------
   STATUS
----------------------------------------- */

if (statusBox) {
  statusBox.style.display = "block";
  statusBox.textContent =
    "Enviando fotos para a IA JT3D...";
}

generateButton.disabled = true;
generateButton.textContent = "Enviando...";


try {

  const response = await fetch(
    `${API_BASE}/api/gerar-3d`,
    {
      method: "POST",
      body: formData
    }
  );


  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "O servidor retornou uma resposta inválida."
    );
  }


  if (!response.ok) {

    throw new Error(
      data.detail ||
      data.message ||
      "Erro ao iniciar a geração."
    );

  }


  if (!data.task_id) {

    throw new Error(
      "O backend não retornou o ID da tarefa."
    );

  }


  if (statusBox) {
    statusBox.textContent =
      "Fotos recebidas. A IA Tripo está criando seu modelo 3D...";
  }


  poll(data.task_id);


} catch (error) {

  console.error(error);

  if (statusBox) {

    statusBox.textContent =
      "Erro: " + error.message;

  }

  generateButton.disabled = false;
  generateButton.textContent =
    "Gerar modelo 3D com IA";

}

});

}

/* =========================================================
CONSULTAR PROCESSAMENTO
========================================================= */

async function poll(taskId) {

try {

const response = await fetch(
  `${API_BASE}/api/tarefa/${taskId}`
);


let data;

try {
  data = await response.json();
} catch {
  throw new Error(
    "Resposta inválida do servidor."
  );
}


if (!response.ok) {

  throw new Error(
    data.detail ||
    "Falha ao consultar a tarefa."
  );

}


const progress =
  Number(data.progress || 0);


if (statusBox) {

  statusBox.textContent =
    `Processando modelo 3D: ${progress}%`;

}


if (progressBar) {

  progressBar.value = progress;

}


/* -----------------------------------------
   SUCESSO
----------------------------------------- */

if (
  data.status === "success" ||
  data.status === "completed"
) {

  if (statusBox) {

    statusBox.textContent =
      "✅ Modelo 3D pronto!";

  }


  generateButton.disabled = false;

  generateButton.textContent =
    "Gerar modelo 3D com IA";


  mostrarResultado(data);

  return;
}


/* -----------------------------------------
   ERRO
----------------------------------------- */

if (
  data.status === "failed" ||
  data.status === "cancelled"
) {

  if (statusBox) {

    statusBox.textContent =
      "❌ A geração do modelo não foi concluída.";

  }

  generateButton.disabled = false;

  generateButton.textContent =
    "Gerar modelo 3D com IA";

  return;
}


/* -----------------------------------------
   CONTINUAR CONSULTANDO
----------------------------------------- */

setTimeout(
  () => poll(taskId),
  2500
);

} catch (error) {

console.error(error);

if (statusBox) {

  statusBox.textContent =
    "Erro ao consultar o processamento: " +
    error.message;

}

generateButton.disabled = false;

generateButton.textContent =
  "Gerar modelo 3D com IA";

}

}

/* =========================================================
MOSTRAR RESULTADO
========================================================= */

function mostrarResultado(data) {

if (!viewer) return;

viewer.classList.remove("hidden");

viewer.scrollIntoView({
behavior: "smooth"
});

const canvas = document.querySelector("#canvas3d");

if (!canvas) return;

let html = `
<div class="result-card">

  <h3>Seu modelo JT3D está pronto!</h3>

`;

if (data.preview_url) {

html += `
  <img
    src="${data.preview_url}"
    alt="Prévia do modelo 3D"
    style="
      max-width:320px;
      width:100%;
      border-radius:16px;
      margin:15px 0;
    "
  >
`;

}

if (data.model_url) {

html += `
  <p>
    <a
      class="download"
      href="${data.model_url}"
      target="_blank"
      rel="noopener noreferrer"
    >
      Abrir modelo 3D
    </a>
  </p>
`;

}

if (data.stl_url) {

html += `
  <p>
    <a
      class="download"
      href="${data.stl_url}"
      target="_blank"
      rel="noopener noreferrer"
    >
      Baixar STL
    </a>
  </p>
`;

}

if (data.model_3mf_url) {

html += `
  <p>
    <a
      class="download"
      href="${data.model_3mf_url}"
      target="_blank"
      rel="noopener noreferrer"
    >
      Baixar 3MF
    </a>
  </p>
`;

}

html += `
<small>
O arquivo retornado pela Tripo pode ter validade limitada.
</small>

</div>

`;

canvas.innerHTML = html;

/* -----------------------------------------
LINKS DE DOWNLOAD
----------------------------------------- */

const downloadStl =
document.querySelector("#downloadStl");

const download3mf =
document.querySelector("#download3mf");

if (downloadStl && data.stl_url) {

downloadStl.href = data.stl_url;

downloadStl.classList.remove("disabled");

downloadStl.removeAttribute("aria-disabled");

}

if (download3mf && data.model_3mf_url) {

download3mf.href = data.model_3mf_url;

download3mf.classList.remove("disabled");

download3mf.removeAttribute("aria-disabled");

}

}
