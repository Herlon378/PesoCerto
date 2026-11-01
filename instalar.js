// ========================================
// TARJA "INSTALAR O APP" (app do curral e gerenciamento)
// ========================================
// Aparece no topo assim que a página abre no navegador do celular.
// - Android (Chrome/Samsung/Edge): o botão "Instalar" abre a instalação
//   de verdade (beforeinstallprompt). Se o navegador não oferecer, mostra
//   onde fica no menu.
// - iPhone/iPad: a Apple não deixa site nenhum instalar sozinho -- o botão
//   abre o passo a passo do Safari (Compartilhar > Adicionar à Tela de Início).
// - Já instalado (Android detecta): a tarja vira "abrir no app".
// - Aberto como app (tela cheia): não aparece nunca.
// Configuração pela própria tag: <script src="instalar.js" data-nome="..."
// data-icone="..." data-chave="..." defer></script>
(function () {
    let tag = document.currentScript;
    let nome = (tag && tag.dataset.nome) || "PesoCerto";
    let icone = (tag && tag.dataset.icone) || "icon-192.png";
    let chave = "pwa_" + ((tag && tag.dataset.chave) || "app");

    let ua = navigator.userAgent || "";
    let ehIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    let ehAndroid = /Android/i.test(ua);
    let ehCelular = ehIOS || ehAndroid;
    // navegador "de dentro" de outro app (Instagram, Facebook, webview do
    // Android) não consegue instalar -- precisa abrir no navegador de verdade
    let navegadorEmbutido = /FBAN|FBAV|Instagram|Line\/|; wv\)/i.test(ua);
    let iosForaDoSafari = ehIOS && /CriOS|FxiOS|EdgiOS/i.test(ua);

    function rodandoComoApp() {
        return window.matchMedia("(display-mode: standalone)").matches
            || window.matchMedia("(display-mode: fullscreen)").matches
            || window.navigator.standalone === true;
    }
    function ler(armazem, k) { try { return armazem.getItem(k); } catch (e) { return null; } }
    function gravar(armazem, k, v) { try { armazem.setItem(k, v); } catch (e) {} }

    let pedidoInstalacao = null;
    let jaInstalado = false;
    let tarja = null;

    window.addEventListener("beforeinstallprompt", e => {
        e.preventDefault();
        pedidoInstalacao = e;
        jaInstalado = false; // o navegador só oferece quando NÃO está instalado
        try { localStorage.removeItem(chave + "_instalado"); } catch (err) {}
        // no computador a tarja só aparece quando o navegador oferece instalar
        if (!tarja && !ehCelular) mostrarTarja();
        else atualizarTarja();
    });
    window.addEventListener("appinstalled", () => {
        pedidoInstalacao = null;
        gravar(localStorage, chave + "_instalado", new Date().toISOString());
        fecharTarja();
        avisar("Pronto! O app foi instalado. Abra pelo ícone na tela inicial.");
    });

    // ---------- estilo (próprio, não depende do style.css de cada página) ----------
    let css = `
        .pwaTarja { position: fixed; left: 0; right: 0; top: 0; z-index: 2147483000; display: flex; align-items: center; gap: 12px;
            padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 10px; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            color: #fff; background: linear-gradient(135deg, #1e3a8a, #2563eb); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.6);
            transform: translateY(-110%); transition: transform 0.35s ease; }
        .pwaTarja.pwaAberta { transform: translateY(0); }
        .pwaTarja img { width: 44px; height: 44px; border-radius: 11px; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
        .pwaTarjaTexto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; line-height: 1.25; }
        .pwaTarjaTexto b { font-size: 14.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pwaTarjaTexto span { font-size: 12.5px; color: rgba(219,234,254,0.92); }
        .pwaTarja button { font-family: inherit; cursor: pointer; margin: 0; box-shadow: none; }
        .pwaBotao { flex-shrink: 0; width: auto; height: 38px; padding: 0 16px; border-radius: 10px; border: none; font-size: 14px; font-weight: 800;
            color: #1e3a8a; background: #fff; white-space: nowrap; }
        .pwaFechar { flex-shrink: 0; width: 32px; height: 32px; padding: 0; border-radius: 50%; border: none; color: #dbeafe; background: rgba(255,255,255,0.12);
            display: flex; align-items: center; justify-content: center; }
        .pwaFechar svg, .pwaPasso svg { width: 18px; height: 18px; }
        .pwaFundo { position: fixed; inset: 0; z-index: 2147483001; display: flex; align-items: flex-end; justify-content: center;
            background: rgba(3,7,18,0.6); font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
        .pwaGuia { width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; box-sizing: border-box; padding: 20px 18px calc(18px + env(safe-area-inset-bottom, 0px));
            border-radius: 20px 20px 0 0; color: #e5edf8; background: #111a2e; border: 1px solid rgba(110,170,255,0.25); }
        @media (min-width: 600px) { .pwaFundo { align-items: center; } .pwaGuia { border-radius: 20px; } }
        .pwaGuiaTopo { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .pwaGuiaTopo img { width: 48px; height: 48px; border-radius: 12px; }
        .pwaGuiaTopo b { display: block; font-size: 17px; color: #fff; }
        .pwaGuiaTopo span { font-size: 13px; color: #9fb0cc; }
        .pwaPasso { display: flex; align-items: center; gap: 12px; padding: 11px 12px; margin-bottom: 8px; border-radius: 12px; background: rgba(255,255,255,0.05); font-size: 14.5px; line-height: 1.4; }
        .pwaPassoNum { width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #0d1426; background: #60a5fa; }
        .pwaPasso i { display: inline-flex; vertical-align: middle; padding: 3px; margin: 0 2px; border-radius: 6px; color: #60a5fa; background: rgba(96,165,250,0.15); font-style: normal; }
        .pwaNota { margin: 10px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 13px; line-height: 1.45; color: #ffd479; background: rgba(255,201,77,0.08); border: 1px solid rgba(255,201,77,0.3); }
        .pwaGuiaBotoes { display: flex; gap: 8px; margin-top: 14px; }
        .pwaGuiaBotoes button { flex: 1; height: 44px; margin: 0; border-radius: 12px; font-family: inherit; font-size: 14.5px; font-weight: 800; cursor: pointer; box-shadow: none; }
        .pwaOk { color: #fff; background: #2563eb; border: none; }
        .pwaSecundario { color: #c9d3e6; background: transparent; border: 1px solid rgba(255,255,255,0.18); }
        .pwaAviso { position: fixed; left: 50%; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); z-index: 2147483002; transform: translateX(-50%); max-width: 90vw;
            padding: 12px 16px; border-radius: 12px; font: 600 14px Inter, system-ui, sans-serif; color: #fff; background: #16a34a; box-shadow: 0 10px 24px rgba(0,0,0,0.4); }
    `;

    const SVG = {
        fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>',
        compartilhar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"></path><path d="M8 7l4-4 4 4"></path><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"></path></svg>',
        adicionar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"></rect><path d="M12 8v8M8 12h8"></path></svg>',
        menu: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>',
        bussola: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M15.5 8.5l-2 5-5 2 2-5z"></path></svg>',
        casa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path></svg>'
    };

    function prepararEstilo() {
        if (document.getElementById("pwaEstilo")) return;
        let s = document.createElement("style");
        s.id = "pwaEstilo";
        s.textContent = css;
        document.head.appendChild(s);
    }

    // texto e botão da tarja conforme a situação
    function situacao() {
        if (jaInstalado) return { titulo: nome + " já está instalado", sub: "Abra pelo app para usar em tela cheia", botao: "Abrir no app", acao: guiaAbrir };
        if (navegadorEmbutido) return { titulo: "Instale o " + nome, sub: "Abra no navegador para instalar", botao: "Como fazer", acao: guiaNavegadorEmbutido };
        if (ehIOS) return { titulo: "Instale o " + nome, sub: "Use como app, direto da tela de início", botao: "Instalar", acao: guiaIOS };
        return { titulo: "Instale o " + nome, sub: "Mais rápido e em tela cheia, como um app", botao: "Instalar", acao: instalarAndroid };
    }

    function mostrarTarja() {
        if (tarja || rodandoComoApp() || ler(sessionStorage, chave + "_fechada")) return;
        let ate = Number(ler(localStorage, chave + "_naoMostrarAte") || 0);
        if (ate && Date.now() < ate) return;
        prepararEstilo();
        tarja = document.createElement("div");
        tarja.className = "pwaTarja";
        tarja.setAttribute("role", "region");
        tarja.setAttribute("aria-label", "Instalar o aplicativo");
        tarja.innerHTML = `<img src="${icone}" alt=""><div class="pwaTarjaTexto"><b></b><span></span></div><button type="button" class="pwaBotao"></button><button type="button" class="pwaFechar" aria-label="Fechar">${SVG.fechar}</button>`;
        tarja.querySelector(".pwaBotao").addEventListener("click", () => situacao().acao());
        tarja.querySelector(".pwaFechar").addEventListener("click", () => { gravar(sessionStorage, chave + "_fechada", "1"); fecharTarja(); });
        document.body.appendChild(tarja);
        atualizarTarja();
        requestAnimationFrame(() => requestAnimationFrame(() => tarja && tarja.classList.add("pwaAberta")));
    }
    function atualizarTarja() {
        if (!tarja) return;
        let s = situacao();
        tarja.querySelector(".pwaTarjaTexto b").textContent = s.titulo;
        tarja.querySelector(".pwaTarjaTexto span").textContent = s.sub;
        tarja.querySelector(".pwaBotao").textContent = s.botao;
    }
    function fecharTarja() {
        if (!tarja) return;
        let t = tarja;
        tarja = null;
        t.classList.remove("pwaAberta");
        setTimeout(() => t.remove(), 400);
    }

    async function instalarAndroid() {
        if (pedidoInstalacao) {
            let pedido = pedidoInstalacao;
            pedidoInstalacao = null; // o navegador só deixa usar uma vez
            pedido.prompt();
            let escolha = await pedido.userChoice.catch(() => null);
            if (escolha && escolha.outcome === "accepted") fecharTarja();
            return;
        }
        guiaAndroid();
    }

    // ---------- guias (janela de baixo pra cima) ----------
    function abrirGuia(titulo, sub, passos, nota, comJaTenho) {
        prepararEstilo();
        let fundo = document.createElement("div");
        fundo.className = "pwaFundo";
        fundo.innerHTML = `
            <div class="pwaGuia" role="dialog" aria-modal="true" aria-label="${titulo}">
                <div class="pwaGuiaTopo"><img src="${icone}" alt=""><div><b>${titulo}</b><span>${sub}</span></div></div>
                ${passos.map((p, i) => `<div class="pwaPasso"><span class="pwaPassoNum">${i + 1}</span><span>${p}</span></div>`).join("")}
                ${nota ? `<p class="pwaNota">${nota}</p>` : ""}
                <div class="pwaGuiaBotoes">${comJaTenho ? `<button type="button" class="pwaSecundario" data-ja-tenho>Já tenho o app</button>` : ""}<button type="button" class="pwaOk">Entendi</button></div>
            </div>`;
        let fechar = () => fundo.remove();
        fundo.addEventListener("click", e => { if (e.target === fundo) fechar(); });
        fundo.querySelector(".pwaOk").addEventListener("click", fechar);
        let jaTenho = fundo.querySelector("[data-ja-tenho]");
        if (jaTenho) jaTenho.addEventListener("click", () => {
            // no iPhone o Safari não tem como saber se o app já foi instalado:
            // para de oferecer por 30 dias
            gravar(localStorage, chave + "_naoMostrarAte", String(Date.now() + 30 * 86400000));
            fechar();
            fecharTarja();
        });
        document.body.appendChild(fundo);
    }

    function guiaIOS() {
        let passos = [
            `Toque em <b>Compartilhar</b> <i>${SVG.compartilhar}</i> ${iosForaDoSafari ? "(na barra de endereço)" : "na barra do Safari (embaixo, ou em cima no iPad)"}`,
            `Role a lista e toque em <b>Adicionar à Tela de Início</b> <i>${SVG.adicionar}</i>`,
            `Toque em <b>Adicionar</b>. O ícone do ${nome} aparece na tela de início <i>${SVG.casa}</i>`
        ];
        abrirGuia("Instalar no iPhone", "A Apple pede que seja feito por aqui", passos,
            "Abriu o link pelo WhatsApp? Primeiro toque no ícone da bússola " + SVG.bussola.replace("<svg", '<svg style="width:15px;height:15px;vertical-align:-3px"') + " (ou em \"Abrir no Safari\") e depois siga os passos. No app instalado você entra com seu usuário e senha uma vez.",
            true);
    }
    function guiaAndroid() {
        abrirGuia("Instalar no Android", "Pelo menu do navegador", [
            `Toque nos <b>três pontinhos</b> <i>${SVG.menu}</i> no canto de cima`,
            `Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b> <i>${SVG.adicionar}</i>`,
            `Confirme em <b>Instalar</b>. O ícone do ${nome} aparece na tela inicial <i>${SVG.casa}</i>`
        ], "Se a opção não aparecer, abra este link no Google Chrome.", false);
    }
    function guiaNavegadorEmbutido() {
        abrirGuia("Abra no navegador", "Daqui de dentro não dá pra instalar", [
            `Toque nos <b>três pontinhos</b> <i>${SVG.menu}</i> ou no ícone <i>${SVG.bussola}</i>`,
            `Escolha <b>Abrir no Chrome</b> (Android) ou <b>Abrir no Safari</b> (iPhone)`,
            `Lá vai aparecer a tarja azul com o botão <b>Instalar</b>`
        ], "", false);
    }
    function guiaAbrir() {
        abrirGuia("Abrir no app", "O " + nome + " já está instalado neste celular", [
            `Toque no ícone do <b>${nome}</b> na tela inicial <i>${SVG.casa}</i>`,
            `Ou, aqui no Chrome, toque nos <b>três pontinhos</b> <i>${SVG.menu}</i> e em <b>Abrir no app</b>`
        ], "Links abertos pelo WhatsApp já abrem direto no app quando ele está instalado.", false);
    }

    function avisar(texto) {
        prepararEstilo();
        let a = document.createElement("div");
        a.className = "pwaAviso";
        a.textContent = texto;
        document.body.appendChild(a);
        setTimeout(() => a.remove(), 4500);
    }

    async function iniciar() {
        if (rodandoComoApp()) return;
        // Android: o Chrome sabe dizer se este app já está instalado
        if (navigator.getInstalledRelatedApps) {
            try { jaInstalado = (await navigator.getInstalledRelatedApps()).length > 0; } catch (e) {}
        }
        if (!jaInstalado && ehAndroid && ler(localStorage, chave + "_instalado") && !pedidoInstalacao) {
            // instalou por aqui antes e o navegador não oferece instalar de novo
            jaInstalado = true;
        }
        if (ehCelular) mostrarTarja();
    }

    // usado por um botão "Instalar app" fixo em cada página, se houver
    window.abrirInstalacaoApp = function () {
        if (rodandoComoApp()) { avisar("Você já está usando o app instalado."); return; }
        situacao().acao();
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
