// ========================================
// MINHA CONTA (app do curral e gerenciamento)
// ========================================
// Qualquer usuário troca o próprio nome, login e senha (sempre com a senha
// atual). O servidor confere tudo de novo (PUT /api/auth/minha-conta): login
// único entre todas as fazendas, nome único na fazenda, e trocar a senha
// desconecta os outros aparelhos dessa pessoa.
(function () {
    const SVG = {
        pessoa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"></path></svg>',
        fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>',
        conversa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"></path></svg>',
        olho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
    };
    const rs = v => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dataBR = d => d ? String(d).slice(0, 10).split("-").reverse().join("/") : "";
    const esc = t => String(t === undefined || t === null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    function prepararEstilo() {
        if (document.getElementById("estiloMinhaConta")) return;
        let s = document.createElement("style");
        s.id = "estiloMinhaConta";
        s.textContent = `
        .mcModal { position: fixed; inset: 0; z-index: 990; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(2,6,16,0.66); }
        .mcModal [hidden] { display: none !important; }
        .mcCaixa { width: min(100%, 460px); max-height: calc(100dvh - 32px); overflow-y: auto; box-sizing: border-box; padding: 18px; border-radius: 18px; color: #e5edf8; text-align: left; background: #111a2b; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 24px 60px rgba(0,0,0,0.55); font-family: inherit; }
        .mcTopo { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .mcTopo > div { flex: 1; min-width: 0; }
        .mcTopo b { display: block; font-size: 17px; color: #fff; }
        .mcTopo small { display: block; font-size: 12.5px; color: #a6b0c6; }
        .mcIcone { width: 42px; height: 42px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 13px; color: #60a5fa; background: rgba(96,165,250,0.12); border: 1px solid rgba(96,165,250,0.35); }
        .mcIcone svg { width: 22px; height: 22px; }
        .mcModal .mcFechar.btn-nao { flex: 0 0 auto; width: 40px; height: 40px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #c9d3e6; }
        .mcFechar svg { width: 18px; height: 18px; }
        .mcGrupo { margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); display: grid; gap: 10px; }
        .mcGrupo h3 { margin: 0; font-size: 12.5px; letter-spacing: 1px; text-transform: uppercase; color: #60a5fa; }
        .mcCampo { display: flex; flex-direction: column; gap: 5px; margin: 0; }
        .mcCampo > span { font-size: 12.5px; font-weight: 600; color: #a6b0c6; }
        .mcCampo small { font-size: 12px; color: #8ea0bd; }
        .mcLinha { position: relative; display: flex; }
        .mcCampo input { width: 100%; box-sizing: border-box; margin: 0; min-height: 46px; padding: 10px 12px; border-radius: 10px; font: inherit; font-size: 16px; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14); }
        .mcCampo input:focus { outline: 2px solid #60a5fa; border-color: transparent; }
        .mcVer { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; border: none; border-radius: 8px; background: transparent; color: #8ea0bd; cursor: pointer; }
        .mcVer svg { width: 18px; height: 18px; }
        .mcLinha input { padding-right: 46px; }
        .mcErro { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 14px; color: #fecaca; background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.4); }
        .mcOk { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 14px; color: #bbf7d0; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.4); }
        .mcAcoes { display: flex; gap: 10px; margin-top: 16px; }
        .mcAcoes button { flex: 1; min-height: 50px; border-radius: 12px; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
        .mcSalvar { color: #fff; background: #16a34a; border: none; }
        .mcSalvar:disabled { opacity: 0.6; }
        .mcCancelar { color: #e5edf8; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.14); }
        .mcPlano { display: grid; gap: 8px; padding: 14px; border-radius: 14px; background: linear-gradient(135deg, rgba(34,197,94,0.13), rgba(56,189,248,0.07)); border: 1px solid rgba(74,222,128,0.35); }
        .mcPlanoTopo { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .mcPlanoTopo b { font-size: 18px; color: #fff; }
        .mcChip { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #7dd3fc; background: rgba(56,189,248,0.14); border: 1px solid rgba(56,189,248,0.4); }
        .mcPlanoDesc { font-size: 12.5px; color: #a6b0c6; line-height: 1.4; }
        .mcPlanoValor b { display: block; font-size: 24px; color: #4ade80; font-variant-numeric: tabular-nums; }
        .mcPlanoValor span { font-size: 12.5px; color: #a6b0c6; }
        .mcExtras { list-style: none; margin: 0; padding: 0; display: grid; }
        .mcExtras li { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; font-size: 14px; border-top: 1px dashed rgba(255,255,255,0.12); }
        .mcExtras small { color: #8ea0bd; }
        .mcExtras b { white-space: nowrap; font-variant-numeric: tabular-nums; }
        .mcUsuarios { font-size: 13px; color: #a6b0c6; }
        .mcAcima { color: #f59e0b; font-weight: 700; }
        .mcSuporte { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; border-radius: 12px; color: #fff; font-weight: 700; font-size: 15px; text-decoration: none; background: rgba(37,211,102,0.16); border: 1px solid rgba(37,211,102,0.5); }
        .mcSuporte svg { width: 18px; height: 18px; color: #4ade80; }
        .btnMinhaConta svg { width: 22px; height: 22px; }
        body.modoDesktop .btnMinhaConta svg { width: 17px; height: 17px; }
        @media (max-width: 560px) { .mcModal { padding: 0; align-items: flex-end; } .mcCaixa { width: 100%; max-height: 94dvh; border-radius: 20px 20px 0 0; } }
        `;
        document.head.appendChild(s);
    }

    // botão no topo (ao lado do "Sair"), só pra quem está logado
    function colocarBotao() {
        let sair = document.getElementById("btnLoginLogout");
        if (!sair || document.getElementById("btnMinhaConta")) return atualizarBotao();
        let b = document.createElement("button");
        b.id = "btnMinhaConta";
        b.type = "button";
        b.className = "pillAcao btnMinhaConta";
        b.title = "Minha conta: nome, login e senha";
        b.setAttribute("aria-label", "Minha conta");
        b.innerHTML = SVG.pessoa;
        b.onclick = () => window.abrirMinhaConta();
        sair.parentNode.insertBefore(b, sair);
        atualizarBotao();
    }
    function atualizarBotao() {
        let b = document.getElementById("btnMinhaConta");
        if (b) b.style.display = typeof obterToken === "function" && obterToken() ? "" : "none";
    }
    window.atualizarBotaoMinhaConta = atualizarBotao;

    window.abrirMinhaConta = function () {
        prepararEstilo();
        let nome = localStorage.getItem("usuarioNome") || "";
        let login = localStorage.getItem("usuarioLogin") || "";
        let modal = document.createElement("div");
        modal.id = "modalMinhaConta";
        modal.className = "modal mcModal";
        modal.style.display = "flex";
        const senha = (id, rotulo, auto) => `<label class="mcCampo"><span>${rotulo}</span><span class="mcLinha"><input id="${id}" type="password" autocomplete="${auto}"><button type="button" class="mcVer" data-ver="${id}" aria-label="Mostrar senha">${SVG.olho}</button></span></label>`;
        modal.innerHTML = `<form class="mcCaixa" novalidate>
            <div class="mcTopo"><span class="mcIcone">${SVG.pessoa}</span><div><b>Minha conta</b><small>Mude seu nome, login ou senha</small></div>
                <button type="button" class="btn-nao mcFechar" data-acao="fechar" aria-label="Fechar">${SVG.fechar}</button></div>
            <div class="mcGrupo" id="mcPlano" hidden></div>
            <div class="mcGrupo">
                <h3>Seus dados</h3>
                <label class="mcCampo"><span>Nome (aparece nos relatórios)</span><input id="mcNome" value="${esc(nome)}" maxlength="80" autocapitalize="words" autocomplete="name"></label>
                <label class="mcCampo"><span>Login (para entrar)</span><input id="mcLogin" value="${esc(login)}" maxlength="40" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" placeholder="${login ? "" : "seu login atual"}"><small>Sem espaço e sem acento. Ex.: jose.silva</small></label>
            </div>
            <div class="mcGrupo">
                <h3>Trocar senha <small style="text-transform:none;letter-spacing:0;color:#8ea0bd">(opcional)</small></h3>
                ${senha("mcNovaSenha", "Senha nova (mínimo 6 caracteres)", "new-password")}
                ${senha("mcConfirma", "Repita a senha nova", "new-password")}
            </div>
            <div class="mcGrupo">
                <h3>Confirme que é você</h3>
                ${senha("mcSenhaAtual", "Sua senha atual", "current-password")}
            </div>
            <p class="mcErro" id="mcErro" hidden></p>
            <p class="mcOk" id="mcOk" hidden></p>
            <div class="mcAcoes"><button type="button" class="mcCancelar" data-acao="fechar">Cancelar</button><button type="submit" class="mcSalvar" id="mcSalvar">Salvar</button></div>
        </form>`;
        document.body.appendChild(modal);
        const $ = id => modal.querySelector("#" + id);
        const erro = t => { $("mcOk").hidden = true; $("mcErro").textContent = t; $("mcErro").hidden = !t; };
        modal.addEventListener("click", e => {
            let ver = e.target.closest("[data-ver]");
            if (ver) { let c = $(ver.dataset.ver); c.type = c.type === "password" ? "text" : "password"; return; }
            if (e.target.closest("[data-acao='fechar']")) modal.remove();
        });
        modal.querySelector("form").addEventListener("submit", async e => {
            e.preventDefault();
            let novoNome = $("mcNome").value.trim().replace(/\s+/g, " ");
            let novoLogin = $("mcLogin").value.trim();
            let nova = $("mcNovaSenha").value, conf = $("mcConfirma").value, atual = $("mcSenhaAtual").value;
            if (!novoNome) return erro("O nome não pode ficar vazio.");
            if (nova && nova.length < 6) return erro("A senha nova precisa ter pelo menos 6 caracteres.");
            if (nova !== conf) return erro("A senha nova e a repetição não são iguais.");
            if (!atual) { $("mcSenhaAtual").focus(); return erro("Digite sua senha atual para confirmar."); }
            if (!navigator.onLine) return erro("Sem internet: trocar a conta precisa de conexão.");
            let corpo = { senhaAtual: atual, nome: novoNome };
            if (novoLogin && novoLogin !== login) corpo.usuario = novoLogin;
            if (nova) corpo.novaSenha = nova;
            let botao = $("mcSalvar");
            botao.disabled = true; botao.textContent = "Salvando…";
            try {
                let resp = await fetch(API_URL + "/api/auth/minha-conta", { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + obterToken() }, body: JSON.stringify(corpo) });
                let dados = await resp.json().catch(() => ({}));
                if (!resp.ok) throw new Error(dados.erro || "Erro " + resp.status);
                localStorage.setItem("usuarioNome", dados.nome);
                localStorage.setItem("usuarioLogin", dados.usuario);
                if (typeof atualizarBotaoLogin === "function") atualizarBotaoLogin();
                let menuNome = document.getElementById("menuNomeUsuario");
                if (menuNome) menuNome.textContent = dados.nome;
                let saud = document.getElementById("saudacaoNome");
                if (saud) saud.textContent = dados.nome;
                let partes = [];
                if (novoNome !== nome) partes.push("nome");
                if (corpo.usuario) partes.push("login");
                if (nova) partes.push("senha");
                modal.remove();
                if (typeof avisoRapidoTela === "function") avisoRapidoTela("Salvo: " + partes.join(", ") + (nova ? ". Os outros aparelhos foram desconectados." : "."));
            } catch (err) {
                erro(err.message);
                botao.disabled = false; botao.textContent = "Salvar";
            }
        });
        setTimeout(() => $("mcNome").focus(), 50);
        carregarMeuPlano(modal);
    };

    // "Meu plano": só o administrador da fazenda, só quando o dono do sistema
    // ligou a visibilidade (o servidor decide; aqui só desenha o que vier).
    async function carregarMeuPlano(modal) {
        let caixa = modal.querySelector("#mcPlano");
        if (!caixa || localStorage.getItem("usuarioPapel") !== "admin" || !navigator.onLine) return;
        try {
            let resp = await fetch(API_URL + "/api/conta/meu-plano", { headers: { "Authorization": "Bearer " + obterToken() } });
            if (!resp.ok) return;
            let p = await resp.json();
            if (!p.visivel || !modal.isConnected) return;
            let valor, nota = "";
            if (p.situacao === "suspensa" || p.situacao === "cancelada") { valor = p.situacao === "suspensa" ? "Assinatura suspensa" : "Assinatura cancelada"; nota = "Fale com o suporte"; }
            else if (p.motivoGratis === "isento") valor = "Liberado grátis";
            else if (p.motivoGratis === "gratis_ate") valor = "Grátis até " + dataBR(p.gratisAte);
            else if (!p.valorMes) valor = "Sem custo";
            else { valor = rs(p.valorMes); nota = "este mês · vence todo dia " + p.diaVencimento; }
            let lim = p.plano && p.plano.limiteUsuarios;
            let acima = lim && p.usuarios > lim;
            let zap = String(p.suporteWhatsapp || "").replace(/\D/g, "");
            if (zap && zap.length <= 11) zap = "55" + zap;
            caixa.innerHTML = `<h3>Meu plano</h3>
                <div class="mcPlano">
                    <div class="mcPlanoTopo"><b>${esc(p.plano ? p.plano.nome : "PesoCerto")}</b>${p.situacao === "teste" ? '<span class="mcChip">Em teste</span>' : ""}</div>
                    ${p.plano && p.plano.descricao ? `<div class="mcPlanoDesc">${esc(p.plano.descricao)}</div>` : ""}
                    <div class="mcPlanoValor"><b>${valor}</b>${nota ? `<span>${nota}</span>` : ""}</div>
                    ${p.extras && p.extras.length ? `<ul class="mcExtras">${p.extras.map(x => `<li><span>${esc(x.descricao)} <small>${x.recorrente ? "todo mês" : "em " + String(x.mesReferencia).split("-").reverse().join("/")}</small></span><b>${rs(x.valor)}</b></li>`).join("")}</ul>` : ""}
                    <div class="mcUsuarios${acima ? " mcAcima" : ""}">${lim ? `${p.usuarios} de ${lim} usuários do plano` : `${p.usuarios} usuário(s) · plano sem limite de usuários`}${acima ? " · acima do limite, fale com o suporte" : ""}</div>
                    ${zap ? `<a class="mcSuporte" href="https://wa.me/${zap}?text=${encodeURIComponent("Olá! Preciso de ajuda com o PesoCerto.")}" target="_blank" rel="noopener">${SVG.conversa}Falar com o suporte</a>` : ""}
                </div>`;
            caixa.hidden = false;
            let sub = modal.querySelector(".mcTopo small");
            if (sub) sub.textContent = "Seu plano, nome, login e senha";
        } catch (e) { /* sem plano: a janela segue normal */ }
    }

    prepararEstilo();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", colocarBotao);
    else colocarBotao();
})();
