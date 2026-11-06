// ========================================
// AVISOS NO CELULAR (app do curral e gerenciamento)
// ========================================
// Painel pra ativar as notificações neste aparelho e escolher o que receber
// (vendas, compras, transferências, contas a pagar, mensagens). Quem envia é
// o servidor (ver /api/push/* no peso-api); aqui o aparelho só se inscreve no
// serviço de push do próprio navegador e manda essa inscrição pro servidor.
// - iPhone: só funciona com o app instalado na tela de início (iOS 16.4+).
// - O que tem valor (vendas/compras/contas...) o servidor só libera pra admin.
// Também cuida de abrir a tela certa quando a pessoa toca num aviso.
(function () {
    const CATEGORIAS = {
        vendas: ["Vendas", "Cada venda lançada, com valor, animais e lote"],
        compras: ["Compras", "Cada compra lançada, com valor, animais e lote"],
        transferencias: ["Transferências", "Animais que mudaram de lote"],
        contas: ["Contas a pagar", "Resumo de manhã: vencidas, vencendo hoje e amanhã"],
        mensagens: ["Mensagens", "Recados enviados pelo administrador"]
    };
    const SVG = {
        sino: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
        sinoOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.9 17.9 0 0 1 18 8"></path><path d="M6.26 6.26A5.9 5.9 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><path d="M2 2l20 20"></path></svg>',
        ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg>'
    };

    const css = `
        .avPainel { margin: 0 0 16px; padding: 16px; border-radius: 18px; color: #e5edf8; background: linear-gradient(160deg, rgba(96,165,250,0.12), transparent 55%), #16203a; border: 1px solid rgba(147,197,253,0.3); }
        .avTopo { display: flex; align-items: center; gap: 12px; }
        .avIcone { width: 42px; height: 42px; flex-shrink: 0; border-radius: 13px; display: flex; align-items: center; justify-content: center; color: #60a5fa; background: rgba(96,165,250,0.16); border: 1px solid rgba(96,165,250,0.35); }
        .avIcone svg { width: 22px; height: 22px; }
        .avPainel.avLigado .avIcone { color: #4ade80; background: rgba(74,222,128,0.14); border-color: rgba(74,222,128,0.4); }
        .avTopo b { display: block; font-size: 16px; color: #fff; }
        .avTopo span { display: block; font-size: 12.5px; color: #a6b0c6; margin-top: 2px; line-height: 1.35; }
        .avTexto { margin: 12px 0 0; font-size: 13.5px; line-height: 1.5; color: #c9d3e6; }
        .avNota { margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; font-size: 13px; line-height: 1.45; color: #ffd479; background: rgba(255,201,77,0.08); border: 1px solid rgba(255,201,77,0.3); }
        .avBotao { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 50px; margin: 14px 0 0; border-radius: 14px; border: none; cursor: pointer; font: inherit; font-size: 16px; font-weight: 800; color: #fff; background: linear-gradient(180deg, #3b82f6, #1d4ed8); box-shadow: 0 8px 20px -10px rgba(59,130,246,0.9); }
        .avBotao svg { width: 20px; height: 20px; }
        .avBotao:disabled { opacity: 0.6; }
        .avLista { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
        .avItem { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; cursor: pointer; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
        .avItem input { position: absolute; opacity: 0; pointer-events: none; }
        .avItemTexto { flex: 1; min-width: 0; }
        .avItemTexto b { display: block; font-size: 14.5px; color: #fff; }
        .avItemTexto small { display: block; font-size: 12px; color: #a6b0c6; line-height: 1.35; }
        .avChave { position: relative; width: 44px; height: 26px; flex-shrink: 0; border-radius: 999px; background: rgba(255,255,255,0.14); transition: background-color 0.2s ease; }
        .avChave::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 0.2s ease; }
        .avItem input:checked + .avChave { background: #22c55e; }
        .avItem input:checked + .avChave::after { transform: translateX(18px); }
        .avItem input:focus-visible + .avChave { outline: 2px solid #60a5fa; outline-offset: 2px; }
        .avAcoes { display: flex; gap: 8px; margin-top: 12px; }
        .avAcoes button { flex: 1; height: 42px; margin: 0; border-radius: 12px; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 700; color: #c9d3e6; background: transparent; border: 1px solid rgba(255,255,255,0.18); }
        .avAcoes .avTestar { color: #9cc8ff; border-color: rgba(96,165,250,0.4); background: rgba(96,165,250,0.08); }
        .avStatus { min-height: 18px; margin: 8px 0 0; font-size: 12.5px; color: #86efac; }
        .avStatus.avErro { color: #ff8a83; }
    `;
    function prepararEstilo() {
        if (document.getElementById("avEstilo")) return;
        let s = document.createElement("style");
        s.id = "avEstilo";
        s.textContent = css;
        document.head.appendChild(s);
    }

    let ua = navigator.userAgent || "";
    let ehIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    let rodandoComoApp = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    let suportado = () => "serviceWorker" in navigator && !!window.PushManager && !!window.Notification;

    async function api(rota, corpo) {
        let resp = await fetch(API_URL + rota, {
            method: corpo ? "POST" : "GET",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + obterToken() },
            body: corpo ? JSON.stringify(corpo) : undefined
        });
        let json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json.erro || "Erro " + resp.status);
        return json;
    }
    function chaveParaBytes(base64) {
        let pad = "=".repeat((4 - base64.length % 4) % 4);
        let bruto = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
        return Uint8Array.from(bruto, c => c.charCodeAt(0));
    }
    async function inscricaoAtual() {
        let reg = await navigator.serviceWorker.ready;
        return reg.pushManager.getSubscription();
    }
    function nomeAparelho() {
        if (ehIOS) return "iPhone/iPad";
        if (/Android/i.test(ua)) return "Android";
        if (/Windows/i.test(ua)) return "Computador (Windows)";
        if (/Mac/i.test(ua)) return "Computador (Mac)";
        return "Outro aparelho";
    }

    function topo(titulo, sub, ligado) {
        return `<div class="avTopo"><span class="avIcone">${ligado ? SVG.sino : SVG.sinoOff}</span><div><b>${titulo}</b><span>${sub}</span></div></div>`;
    }

    async function desenhar(el) {
        prepararEstilo();
        el.className = "avPainel";
        if (!suportado()) {
            if (ehIOS && !rodandoComoApp()) {
                el.innerHTML = topo("Avisos no celular", "Precisa do app instalado") +
                    `<p class="avTexto">No iPhone, os avisos só funcionam com o PesoCerto <b>instalado na tela de início</b> (iOS 16.4 ou mais novo). Instale e abra pelo ícone, depois ative aqui.</p>` +
                    `<button type="button" class="avBotao" data-acao="instalar">Como instalar</button>`;
            } else {
                el.innerHTML = topo("Avisos no celular", "Indisponível neste navegador") +
                    `<p class="avTexto">Este navegador não recebe avisos. No Android, use o Chrome; no iPhone, o app instalado na tela de início.</p>`;
            }
            return;
        }
        if (Notification.permission === "denied") {
            el.innerHTML = topo("Avisos bloqueados", "O celular está bloqueando os avisos deste app") +
                `<p class="avNota">Pra liberar: abra as <b>Configurações do celular</b> → <b>Apps</b> (ou Notificações) → <b>${rodandoComoApp() ? "PesoCerto" : "o navegador"}</b> → <b>Notificações</b> → permitir. Depois volte aqui.</p>`;
            return;
        }
        el.innerHTML = topo("Avisos no celular", "Carregando…");
        let config, estado = { ativa: false, categorias: [] }, sub = null;
        try {
            config = await api("/api/push/config");
            sub = await inscricaoAtual();
            if (sub) estado = await api("/api/push/estado", { endpoint: sub.endpoint });
        } catch (e) {
            el.innerHTML = topo("Avisos no celular", "Sem conexão agora") + `<p class="avTexto">Conecte na internet pra ativar ou mudar os avisos.</p>`;
            return;
        }
        if (!estado.ativa) {
            el.innerHTML = topo("Avisos no celular", "Desativados neste aparelho") +
                `<p class="avTexto">Receba uma notificação na hora, mesmo com o app fechado: ${config.categorias.map(c => CATEGORIAS[c][0].toLowerCase()).join(", ")}.</p>` +
                `<button type="button" class="avBotao" data-acao="ativar">${SVG.sino}Ativar avisos</button><p class="avStatus" aria-live="polite"></p>`;
            return;
        }
        el.classList.add("avLigado");
        el.innerHTML = topo("Avisos ativados", "Escolha o que este aparelho recebe", true) +
            `<div class="avLista">${config.categorias.map(c => `
                <label class="avItem"><span class="avItemTexto"><b>${CATEGORIAS[c][0]}</b><small>${CATEGORIAS[c][1]}</small></span>
                <input type="checkbox" data-categoria="${c}" ${estado.categorias.includes(c) ? "checked" : ""}><span class="avChave" aria-hidden="true"></span></label>`).join("")}</div>` +
            `<div class="avAcoes"><button type="button" class="avTestar" data-acao="testar">Enviar aviso de teste</button><button type="button" data-acao="desativar">Desativar</button></div>` +
            `<p class="avStatus" aria-live="polite"></p>`;
    }

    function status(el, texto, erro) {
        let s = el.querySelector(".avStatus");
        if (!s) return;
        s.textContent = texto;
        s.classList.toggle("avErro", !!erro);
    }

    async function ativar(el) {
        let botao = el.querySelector("[data-acao='ativar']");
        if (botao) botao.disabled = true;
        try {
            // o pedido de permissão TEM que sair do toque no botão (regra dos navegadores)
            let permissao = await Notification.requestPermission();
            if (permissao !== "granted") { await desenhar(el); return; }
            let config = await api("/api/push/config");
            let reg = await navigator.serviceWorker.ready;
            let sub = await reg.pushManager.getSubscription() ||
                await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(config.chavePublica) });
            await api("/api/push/inscrever", { inscricao: sub.toJSON(), categorias: config.categorias, aparelho: nomeAparelho() });
            await desenhar(el);
            status(el, "Pronto! Toque em \"Enviar aviso de teste\" pra ver como chega.");
        } catch (e) {
            if (botao) botao.disabled = false;
            status(el, "Não deu pra ativar: " + e.message, true);
        }
    }

    async function salvarCategorias(el) {
        let categorias = Array.from(el.querySelectorAll("input[data-categoria]:checked")).map(i => i.dataset.categoria);
        try {
            let sub = await inscricaoAtual();
            if (!sub) { await desenhar(el); return; }
            await api("/api/push/inscrever", { inscricao: sub.toJSON(), categorias, aparelho: nomeAparelho() });
            status(el, categorias.length ? "Salvo." : "Salvo. Nenhum aviso marcado — este aparelho não vai receber nada.");
        } catch (e) {
            status(el, "Não deu pra salvar: " + e.message, true);
        }
    }

    async function testar(el) {
        try {
            let sub = await inscricaoAtual();
            await api("/api/push/testar", { endpoint: sub && sub.endpoint });
            status(el, "Aviso de teste enviado. Deve chegar em alguns segundos.");
        } catch (e) {
            status(el, "Não deu pra testar: " + e.message, true);
        }
    }

    async function desativar(el) {
        try {
            let sub = await inscricaoAtual();
            if (sub) {
                await api("/api/push/cancelar", { endpoint: sub.endpoint }).catch(() => {});
                await sub.unsubscribe();
            }
            await desenhar(el);
        } catch (e) {
            status(el, "Não deu pra desativar: " + e.message, true);
        }
    }

    // monta (ou atualiza) o painel dentro do elemento com esse id
    window.montarPainelAvisos = function (id) {
        let el = document.getElementById(id);
        if (!el) return;
        if (!el.dataset.avPronto) {
            el.dataset.avPronto = "1";
            el.addEventListener("click", e => {
                let b = e.target.closest("[data-acao]");
                if (!b) return;
                let acao = b.dataset.acao;
                if (acao === "ativar") ativar(el);
                else if (acao === "testar") testar(el);
                else if (acao === "desativar") desativar(el);
                else if (acao === "instalar" && typeof abrirInstalacaoApp === "function") abrirInstalacaoApp();
            });
            el.addEventListener("change", e => { if (e.target.matches("input[data-categoria]")) salvarCategorias(el); });
        }
        desenhar(el);
    };

    // ---------- tocar no aviso abre a tela certa ----------
    function abrirTelaDoAviso(tela) {
        if (!tela || typeof obterToken !== "function" || !obterToken()) return;
        if (document.body.classList.contains("modoDesktop")) {
            let botao = document.querySelector(`.navDesktop [data-tela="${tela}"]`);
            if (botao) { botao.click(); return; }
        }
        if (tela === "telaResultado" && typeof abrirRelatorios === "function") { abrirRelatorios(); return; }
        if (tela === "telaMensagens" && typeof abrirTelaMensagensMobile === "function") { trocarTela("telaMensagens"); abrirTelaMensagensMobile(); return; }
        if (document.getElementById(tela)) trocarTela(tela);
    }
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", e => {
            if (e.data && e.data.tipo === "abrirTelaAviso") abrirTelaDoAviso(e.data.tela);
        });
    }
    // app aberto pelo toque no aviso: "#aviso=telaX" no endereço
    let pedido = (location.hash.match(/^#aviso=(\w+)$/) || [])[1];
    if (pedido) {
        history.replaceState(history.state, "", location.pathname + location.search);
        let tentativas = 0;
        let tentar = () => {
            // espera o app terminar de abrir (login restaurado, primeira tela)
            if (document.querySelector(".tela.ativa") && typeof obterToken === "function" && obterToken()) abrirTelaDoAviso(pedido);
            else if (++tentativas < 20) setTimeout(tentar, 300);
        };
        setTimeout(tentar, 900);
    }
})();
