export const translations = {
  en: {
    title: "The Grid Social",
    subtitle: "A global neural network of human thoughts.",
    msgs_label: "NODES ACTIVE",
    btn_action: "INITIALIZE UPLINK",
    modal_title: "TRANSMISSION",
    modal_desc: "Establishing secure connection to current coordinates.",
    label_name: "CODENAME / ID",
    ph_name: "Identity...",
    label_msg: "DATA PACKET",
    ph_msg: "Input data stream...",
    btn_submit: "UPLOAD TO GRID",
    success_title: "UPLOAD COMPLETE",
    success_desc: "Your data node has been synchronized globally.",
    btn_close: "[ Close Terminal ]",
    btn_action_update: "UPDATE SIGNAL",
    btn_submit_update: "UPDATE GRID",
    btn_delete: "TERMINATE SIGNAL",
    error_profanity: "ERROR: Profanity detected in data stream.",
  },
  pt: {
    title: "Mural Global",
    subtitle: "Uma rede neural global de pensamentos humanos.",
    msgs_label: "NÓS ATIVOS",
    btn_action: "INICIAR UPLINK",
    modal_title: "TRANSMISSÃO",
    modal_desc: "Estabelecendo conexão segura com coordenadas atuais.",
    label_name: "CODINOME / ID",
    ph_name: "Identidade...",
    label_msg: "PACOTE DE DADOS",
    ph_msg: "Insira fluxo de dados...",
    btn_submit: "ENVIAR PARA A GRADE",
    success_title: "UPLOAD COMPLETO",
    success_desc: "Seu nó de dados foi sincronizado globalmente.",
    btn_close: "[ Fechar Terminal ]",
    btn_action_update: "ATUALIZAR SINAL",
    btn_submit_update: "ATUALIZAR GRADE",
    btn_delete: "TERMINAR SINAL",
    error_profanity: "ERRO: Profanidade detectada no fluxo de dados.",
  },
  es: {
    title: "The Grid Social",
    subtitle: "Una red neuronal global de pensamientos humanos.",
    msgs_label: "NODOS ACTIVOS",
    btn_action: "INICIAR ENLACE",
    modal_title: "TRANSMISIÓN",
    modal_desc: "Estableciendo conexión segura con coordenadas actuales.",
    label_name: "NOMBRE EN CLAVE / ID",
    ph_name: "Identidad...",
    label_msg: "PAQUETE DE DATOS",
    ph_msg: "Ingrese flujo de datos...",
    btn_submit: "SUBIR A LA RED",
    success_title: "CARGA COMPLETA",
    success_desc: "Su nodo de datos se ha sincronizado globalmente.",
    btn_close: "[ Cerrar Terminal ]",
    btn_action_update: "ACTUALIZAR SEÑAL",
    btn_submit_update: "ACTUALIZAR RED",
    btn_delete: "TERMINAR SEÑAL",
    error_profanity: "ERROR: Profanidad detectada en el flujo de datos.",
  },
  // Outros idiomas podem ser adicionados aqui
};

export function applyLanguage() {
  // Detecta o idioma diretamente do navegador (ex: "pt-BR" -> "pt")
  const userLang = navigator.language.split("-")[0];

  const langData = translations[userLang] || translations["en"];
  const enData = translations["en"];

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (langData && langData[key]) el.innerText = langData[key];
    else if (enData && enData[key]) el.innerText = enData[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (langData && langData[key]) el.placeholder = langData[key];
  });

  if (userLang === "ar") {
    document.body.style.direction = "rtl";
  }
}
