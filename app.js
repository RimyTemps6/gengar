import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  onSnapshot, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

/* ---------- Dados iniciais (usados só na primeira vez) ---------- */
const DEFAULTS = {
  "Servos Expansion": [
    { id: "servoAR", port: "4", desc: "Aerofólio", prog: "servoAR", val1: "Para Frente", v1: "0.8", val2: "Nas Consta", v2: "0.6" },
    { id: "servoAL", port: "2", desc: "Aerofólio", prog: "servoAL", val1: "Para Frente", v1: "0.8", val2: "Nas Consta", v2: "0.6" },
    { id: "turret", port: "5", desc: "Turret", prog: "turret", val1: "N/A", v1: "-", val2: "N/A", v2: "-" },
    { id: "turretAjustL", port: "0", desc: "Regula Tamanho Polen/Nectar", prog: "turretAjustL", val1: "Polen", v1: "0.1", val2: "Néctar", v2: "0.3" },
    { id: "turretAjustR", port: "1", desc: "Regula Tamanho Polen/Nectar", prog: "turretAjustR", val1: "Polen", v1: "0.12", val2: "Néctar", v2: "0.5" }
  ],
  "Servos Control Hub": [
    { id: "servoIntk", port: "3", desc: "Porteira Intake Cheio", prog: "servoIntk", val1: "Fechado", v1: "0.65", val2: "Aberto", v2: "1.0" },
    { id: "servoR", port: "4", desc: "Libera Polen/Nectar Shooter", prog: "servoR", val1: "Fechado", v1: "0.47", val2: "Aberto", v2: "0.2" }
  ],
  "Motores Expansion": [
    { id: "indexer", port: "0", desc: "Empurra Polen/Nectar", prog: "indexer", val1: "Coletando", v1: "-0.6", val2: "Expelindo", v2: "0.6" },
    { id: "intake", port: "2", desc: "Coleta Polen/Nectar", prog: "intake", val1: "Coletando", v1: "-0.6", val2: "Expelindo", v2: "0.6" },
    { id: "roda1", port: "1", desc: "Rodas Direita", prog: "roda1", val1: "Modo", v1: "Por Analogico", val2: "N/A", v2: "-" },
    { id: "roda3", port: "3", desc: "Rodas Direita", prog: "roda3", val1: "Modo", v1: "Por Analogico", val2: "N/A", v2: "-" }
  ],
  "Motores Control Hub": [
    { id: "roda0", port: "0", desc: "Rodas Esquerda", prog: "roda0", val1: "Modo", v1: "Por Analogico", val2: "N/A", v2: "-" },
    { id: "roda2", port: "2", desc: "Rodas Esquerda", prog: "roda2", val1: "Modo", v1: "Por Analogico", val2: "N/A", v2: "-" },
    { id: "shooterL", port: "1", desc: "Motores do Shooter", prog: "shooterL", val1: "Modo", v1: "Hipotenusa", val2: "N/A", v2: "-" },
    { id: "shooterR", port: "3", desc: "Motores do Shooter", prog: "shooterR", val1: "Modo", v1: "Hipotenusa", val2: "N/A", v2: "-" }
  ],
  "I2C Sensor De Cor Expansion": [
    { id: "distIntake2", port: "0 (Bus 1)", desc: "Depois do distIntake3", prog: "distIntake2", val1: "Distancia Carregado", v1: "2", val2: "N/A", v2: "-" },
    { id: "distIntake3", port: "0 (Bus 2)", desc: "Depois do distIntake4", prog: "distIntake3", val1: "Distancia Carregado", v1: "3.5", val2: "N/A", v2: "-" },
    { id: "distIntake4", port: "0 (Bus 3)", desc: "Mais Longe do Intake", prog: "distIntake4", val1: "Distancia Carregado", v1: "3.5", val2: "N/A", v2: "-" }
  ],
  "I2C Sensor De Cor Control Hub": [
    { id: "imu", port: "0 (Bus 0)", desc: "Giroscopio Interno", prog: "Sem Nome", val1: "Valor", v1: "Sem Valor", val2: "N/A", v2: "-" },
    { id: "pinpoint", port: "0 (Bus 1)", desc: "Informações Gobilda", prog: "pinpoint", val1: "Valor", v1: "Sem Valor", val2: "N/A", v2: "-" },
    { id: "distIntake1", port: "0 (Bus 2)", desc: "Mais Próximo do Intake", prog: "distIntake1", val1: "Distancia Carregado", v1: "4.2", val2: "N/A", v2: "-" }
  ]
};
const SECTION_ORDER = Object.keys(DEFAULTS);
const BUTTONS = ["LB", "RB", "LT", "RT", "A", "B", "X", "Y"];

/* ---------- Firebase ---------- */
const fbApp = initializeApp(firebaseConfig);
let db;
try {
  db = initializeFirestore(fbApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn("Cache offline indisponível, usando memória:", e);
  db = initializeFirestore(fbApp, {});
}
const devicesCol = collection(db, "dispositivos");
const controlsCol = collection(db, "controles");

/* ---------- Utilidades ---------- */
const $ = (s) => document.querySelector(s);
const appEl = $("#app");
const statusEl = $("#status");

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function slug(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "x";
}
function logErr(e) { console.error(e); setStatus("off", "⚠ Erro ao salvar"); }

let netState = { saving: false, cache: false };
function setStatus(kind, text) {
  statusEl.className = "pill " + kind;
  statusEl.textContent = text;
}
function refreshStatus() {
  if (!navigator.onLine) return setStatus("off", "○ Offline — salva quando voltar");
  if (netState.saving) return setStatus("saving", "↻ Salvando…");
  if (netState.cache) return setStatus("saving", "↻ Conectando…");
  setStatus("ok", "● Sincronizado em tempo real");
}
window.addEventListener("online", refreshStatus);
window.addEventListener("offline", refreshStatus);

/* ---------- Seções e cartões ---------- */
const sections = new Map(); // nome -> { wrap, grid }
const cards = new Map();    // id do doc -> elemento do cartão

function getSection(name) {
  if (sections.has(name)) return sections.get(name);
  const wrap = el("div", "section");
  wrap.appendChild(el("div", "section-title", name));
  const grid = el("div", "device-grid");
  wrap.appendChild(grid);
  const actions = el("div", "section-actions");
  const add = el("button", "add-btn", "➕ Adicionar dispositivo");
  add.addEventListener("click", () => addDevice(name));
  actions.appendChild(add);
  wrap.appendChild(actions);
  appEl.appendChild(wrap);
  const s = { wrap, grid };
  sections.set(name, s);
  return s;
}

function bind(inp, docId, field) {
  let t;
  const send = () => {
    clearTimeout(t);
    updateDoc(doc(db, "dispositivos", docId), { [field]: inp.value }).catch(logErr);
  };
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(send, 400); });
  inp.addEventListener("change", send);
}

function field(card, docId, name, inp) {
  card._inputs[name] = inp;
  bind(inp, docId, name);
  return inp;
}

function textInput(cls, placeholder) {
  const i = document.createElement("input");
  i.type = "text";
  if (cls) i.className = cls;
  if (placeholder) i.placeholder = placeholder;
  return i;
}

function makeCard(docId) {
  const card = el("div", "device-card");
  card.dataset.id = docId;
  card._inputs = {};

  const head = el("div", "device-header");
  head.appendChild(field(card, docId, "id", textInput("name-input", "ID do dispositivo")));
  const portWrap = el("label", "port-edit");
  portWrap.append("Porta ");
  portWrap.appendChild(field(card, docId, "port", textInput("", "0")));
  head.appendChild(portWrap);
  const del = el("button", "del-btn", "🗑");
  del.title = "Remover dispositivo";
  del.addEventListener("click", () => {
    const nome = card._inputs.id.value || "este dispositivo";
    if (confirm(`Remover "${nome}" para todo mundo?`)) deleteDoc(doc(db, "dispositivos", docId)).catch(logErr);
  });
  head.appendChild(del);
  card.appendChild(head);

  const g1 = el("div", "input-group");
  g1.appendChild(el("label", null, "Descrição"));
  g1.appendChild(field(card, docId, "desc", textInput()));
  card.appendChild(g1);

  const g2 = el("div", "input-group");
  g2.appendChild(el("label", null, "Nome na Programação"));
  g2.appendChild(field(card, docId, "prog", textInput()));
  card.appendChild(g2);

  const row = el("div", "value-row");
  [["val1", "v1"], ["val2", "v2"]].forEach(([lab, val]) => {
    const g = el("div", "input-group");
    g.appendChild(field(card, docId, lab, textInput("label-input", "Nome do valor")));
    g.appendChild(field(card, docId, val, textInput()));
    row.appendChild(g);
  });
  card.appendChild(row);
  return card;
}

function fillCard(card, data) {
  card.dataset.ordem = data.ordem ?? 0;
  for (const [name, inp] of Object.entries(card._inputs)) {
    const v = data[name] ?? "";
    if (document.activeElement !== inp && inp.value !== v) inp.value = v;
  }
}

function sortGrid(grid) {
  const now = [...grid.children];
  const sorted = [...now].sort((a, b) => (+a.dataset.ordem) - (+b.dataset.ordem));
  if (now.some((c, i) => c !== sorted[i])) sorted.forEach((c) => grid.appendChild(c));
}

onSnapshot(devicesCol, { includeMetadataChanges: true }, (snap) => {
  const touched = new Set();
  snap.docChanges().forEach((ch) => {
    const id = ch.doc.id;
    let card = cards.get(id);
    if (ch.type === "removed") {
      if (card) { card.remove(); cards.delete(id); }
      return;
    }
    const data = ch.doc.data();
    if (card && card.dataset.secao !== data.secao) { card.remove(); cards.delete(id); card = null; }
    if (!card) {
      card = makeCard(id);
      card.dataset.secao = data.secao;
      cards.set(id, card);
      getSection(data.secao).grid.appendChild(card);
    }
    fillCard(card, data);
    touched.add(data.secao);
  });
  touched.forEach((s) => sortGrid(getSection(s).grid));
  netState.saving = snap.metadata.hasPendingWrites;
  netState.cache = snap.metadata.fromCache && navigator.onLine && snap.empty;
  refreshStatus();
}, (err) => { console.error(err); setStatus("off", "⚠ Sem permissão ou sem conexão"); });

async function addDevice(secao) {
  const ordens = [...getSection(secao).grid.children].map((c) => +c.dataset.ordem || 0);
  const ordem = Math.max(0, ...ordens) + 10;
  try {
    await addDoc(devicesCol, {
      secao, ordem, id: "novo", port: "0", desc: "", prog: "",
      val1: "Valor 1", v1: "", val2: "Valor 2", v2: ""
    });
  } catch (e) { logErr(e); }
}

$("#addSectionBtn").addEventListener("click", () => {
  const nome = (prompt("Nome da nova seção:") || "").trim();
  if (!nome) return;
  addDevice(nome);
});

/* ---------- Controles ---------- */
const ctrlInputs = [...document.querySelectorAll(".ctrl-input")];
ctrlInputs.forEach((inp) => {
  let t;
  const send = () => {
    clearTimeout(t);
    setDoc(doc(db, "controles", "c" + inp.dataset.ctrl), { [inp.dataset.btn]: inp.value }, { merge: true }).catch(logErr);
  };
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(send, 400); });
  inp.addEventListener("change", send);
});

onSnapshot(controlsCol, { includeMetadataChanges: true }, (snap) => {
  snap.docs.forEach((d) => {
    const n = d.id.replace("c", "");
    const data = d.data();
    ctrlInputs.filter((i) => i.dataset.ctrl === n).forEach((inp) => {
      const v = data[inp.dataset.btn];
      if (v != null && document.activeElement !== inp && inp.value !== v) inp.value = v;
    });
  });
}, (err) => console.error(err));

/* ---------- Primeira execução: cria os dados ---------- */
async function seedIfNeeded() {
  const metaRef = doc(db, "meta", "init");
  try {
    const m = await getDoc(metaRef);
    if (m.exists()) return;
  } catch (e) { console.warn("Seed adiado:", e); return; }

  let src = DEFAULTS, ctrl = {};
  try {
    const s = localStorage.getItem("ftc_config_data");
    if (s) src = JSON.parse(s);
    const c = localStorage.getItem("ftc_ctrl_data");
    if (c) ctrl = JSON.parse(c);
  } catch (_) { /* usa os padrões */ }

  const batch = writeBatch(db);
  Object.entries(src).forEach(([secao, list]) => {
    list.forEach((d, i) => {
      batch.set(doc(db, "dispositivos", slug(secao) + "__" + slug(d.id)), {
        secao, ordem: i,
        id: String(d.id ?? ""), port: String(d.port ?? ""), desc: String(d.desc ?? ""),
        prog: String(d.prog ?? ""), val1: String(d.val1 ?? ""), v1: String(d.v1 ?? ""),
        val2: String(d.val2 ?? ""), v2: String(d.v2 ?? "")
      });
    });
  });
  ["0", "1"].forEach((n) => {
    const data = {};
    BUTTONS.forEach((b) => { data[b] = String((ctrl[n] && ctrl[n][b]) || "S/V"); });
    batch.set(doc(db, "controles", "c" + n), data);
  });
  batch.set(metaRef, { criadoEm: serverTimestamp() });
  await batch.commit();
}

SECTION_ORDER.forEach(getSection);
seedIfNeeded().catch(logErr);

/* ---------- Exportar texto ---------- */
function buildText() {
  const line = "---------------------------------------------------------------------------------------------------------------------------\n\n";
  let text = "Motores Do Robô - BrainMachine #17728\n\n" + line + "MAPEAMENTO DE CONTROLES\n\n";
  [0, 1].forEach((n) => {
    text += `${n === 0 ? "Controle 0 (Driver)" : "Controle 1 (Operator)"}:\n`;
    ctrlInputs.filter((i) => +i.dataset.ctrl === n).forEach((i) => { text += `  - ${i.dataset.btn}: ${i.value}\n`; });
    text += "\n";
  });
  text += line;
  for (const [name, s] of sections) {
    const list = [...s.grid.children];
    if (!list.length) continue;
    text += `${name}:\n\n`;
    list.forEach((c) => {
      const v = (k) => c._inputs[k].value;
      let l = `${v("id")} (Porta ${v("port")}) - ${v("desc")}    Nome Na Programação: (${v("prog")})`;
      if (v("v1") && v("v1") !== "-") l += `    ${v("val1")}: (${v("v1")})`;
      if (v("v2") && v("v2") !== "-") l += `    ${v("val2")}: (${v("v2")})`;
      text += l + "\n";
    });
    text += "\n" + line;
  }
  return text;
}

const exportArea = $("#exportArea");
const hideables = [appEl, $("#controllers"), $("#addSectionBtn"), $(".topbar")];
$("#exportBtn").addEventListener("click", () => {
  $("#outputText").value = buildText();
  hideables.forEach((e) => { e.style.display = "none"; });
  exportArea.style.display = "block";
  window.scrollTo(0, 0);
});
$("#backBtn").addEventListener("click", () => {
  hideables.forEach((e) => { e.style.display = ""; });
  exportArea.style.display = "none";
});
$("#copyBtn").addEventListener("click", async () => {
  const ta = $("#outputText");
  try { await navigator.clipboard.writeText(ta.value); }
  catch (_) { ta.select(); document.execCommand("copy"); }
  $("#copyBtn").textContent = "Copiado ✔";
  setTimeout(() => { $("#copyBtn").textContent = "Copiar"; }, 1500);
});

/* ---------- Instalar no celular (PWA) ---------- */
const installBtn = $("#installBtn");
let deferredPrompt = null;
const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  } else {
    alert("No iPhone: toque em Compartilhar e depois em 'Adicionar à Tela de Início'.");
  }
});
if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) installBtn.hidden = false;
window.addEventListener("appinstalled", () => { installBtn.hidden = true; });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.warn));
}
