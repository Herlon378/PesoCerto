(function () {
    let original = window.trocarTela;
    window.trocarTela = function (id) {
        original(id);
        document.body.classList.remove("menuCelularAberto");
        document.querySelectorAll(".navDesktop [data-tela]").forEach(b => {
            b.classList.toggle("navAtivo", b.dataset.tela === id);
        });
    };

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll(".navDesktop [data-tela]").forEach(b => {
            b.classList.toggle("navAtivo", b.dataset.tela === "telaDashboard");
        });
    });

    // atualização periódica: tela de gerenciamento fica sempre com dado fresco
    setInterval(() => {
        if (document.visibilityState === "visible") {
            sincronizarAgora();
        }
    }, 60000);
})();

// ========================================
// CONFIRMAÇÃO/AVISO MODERNOS (substitui confirm()/alert() nativos do
// navegador em todo o painel desktop pelo mesmo cartãozinho escuro já
// usado nos outros modais do sistema -- um único modal reaproveitado por
// todo mundo, resolvido por Promise pra poder usar "await" no lugar exato
// onde antes estava o confirm()/alert() síncrono)
// ========================================
let _resolvedorModalConfirmacaoModerna = null;

function confirmarModerno(mensagem, opcoes) {
    opcoes = opcoes || {};
    return new Promise(resolve => {
        _resolvedorModalConfirmacaoModerna = resolve;
        document.getElementById("confirmacaoModernaTitulo").innerText = opcoes.titulo || "⚠️ Atenção";
        document.getElementById("confirmacaoModernaTexto").innerText = mensagem;
        document.getElementById("confirmacaoModernaBtnCancelar").style.display = "inline-block";
        document.getElementById("confirmacaoModernaBtnOk").innerText = opcoes.textoConfirmar || "Confirmar";
        document.getElementById("modalConfirmacaoModerna").style.display = "flex";
    });
}

function alertarModerno(mensagem, opcoes) {
    opcoes = opcoes || {};
    return new Promise(resolve => {
        _resolvedorModalConfirmacaoModerna = () => resolve(true);
        document.getElementById("confirmacaoModernaTitulo").innerText = opcoes.titulo || "Aviso";
        document.getElementById("confirmacaoModernaTexto").innerText = mensagem;
        document.getElementById("confirmacaoModernaBtnCancelar").style.display = "none";
        document.getElementById("confirmacaoModernaBtnOk").innerText = "OK";
        document.getElementById("modalConfirmacaoModerna").style.display = "flex";
    });
}

function _resolverModalConfirmacaoModerna(valor) {
    document.getElementById("modalConfirmacaoModerna").style.display = "none";
    let resolve = _resolvedorModalConfirmacaoModerna;
    _resolvedorModalConfirmacaoModerna = null;
    if (resolve) resolve(valor);
}

// ========================================
// GERENCIAMENTO DE USUÁRIOS
// ========================================
let usuarioEditandoId = null;

// ícones próprios da tela de Usuários (traço fino, mesmo estilo do menu)
const ICONES_USUARIOS = {
    "maisUsuario": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle><path d=\"M19 8v6M22 11h-6\"></path></svg>",
    "megafone": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z\"></path><path d=\"M15.5 8.5a5 5 0 0 1 0 7\"></path><path d=\"M18.5 5.5a9 9 0 0 1 0 13\"></path></svg>",
    "usuarios": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle><path d=\"M23 21v-2a4 4 0 0 0-3-3.87\"></path><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"></path></svg>",
    "escudo": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z\"></path><path d=\"M9.5 12l2 2 3.5-4\"></path></svg>",
    "operador": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"8\" r=\"4\"></circle><path d=\"M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1\"></path></svg>",
    "busca": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"></line></svg>",
    "editar": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 20h9\"></path><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"></path></svg>",
    "desativar": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M5.6 5.6l12.8 12.8\"></path></svg>",
    "ativar": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M8.5 12l2.5 2.5 4.5-5\"></path></svg>",
    "lixeira": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 6h18\"></path><path d=\"M8 6V4h8v2\"></path><path d=\"M19 6l-1 14H6L5 6\"></path><path d=\"M10 11v6M14 11v6\"></path></svg>",
    "balanca": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3v18\"></path><path d=\"M5 7h14\"></path><path d=\"M5 7l-3 7a3 3 0 0 0 6 0z\"></path><path d=\"M19 7l-3 7a3 3 0 0 0 6 0z\"></path><path d=\"M8 21h8\"></path></svg>",
    "grafico": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"9\" rx=\"1.5\"></rect><rect x=\"14\" y=\"3\" width=\"7\" height=\"5\" rx=\"1.5\"></rect><rect x=\"14\" y=\"12\" width=\"7\" height=\"9\" rx=\"1.5\"></rect><rect x=\"3\" y=\"16\" width=\"7\" height=\"5\" rx=\"1.5\"></rect></svg>",
    "relatorio": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"></path><polyline points=\"14 2 14 8 20 8\"></polyline><line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"></line><line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"></line></svg>",
    "dinheiro": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" rx=\"2\"></rect><circle cx=\"12\" cy=\"12\" r=\"2.5\"></circle><path d=\"M6 12h.01M18 12h.01\"></path></svg>",
    "caixa": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\"></path><polyline points=\"3.27 6.96 12 12.01 20.73 6.96\"></polyline><line x1=\"12\" y1=\"22.08\" x2=\"12\" y2=\"12\"></line></svg>",
    "boi": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 4c0 3 1.5 4.5 4 4.5h8c2.5 0 4-1.5 4-4.5\"></path><path d=\"M7 8.5v5a5 5 0 0 0 10 0v-5\"></path><path d=\"M9.5 17.5h5\"></path><circle cx=\"10\" cy=\"12\" r=\".7\" fill=\"currentColor\"></circle><circle cx=\"14\" cy=\"12\" r=\".7\" fill=\"currentColor\"></circle></svg>",
    "lapis": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"></path></svg>",
    "estrela": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><polygon points=\"12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2\"></polygon></svg>"
};

let usuariosCacheTela = [];
let filtroUsuariosTela = "todos";

async function carregarUsuarios() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaUsuarios");
    if (!token || !corpo) return;

    try {
        let resp = await fetch(`${API_URL}/api/usuarios`, {
            headers: { "Authorization": "Bearer " + token }
        });
        if (!resp.ok) {
            corpo.innerHTML = `<p class="ltVazio">Acesso restrito a administradores, ou sessão expirada.</p>`;
            return;
        }
        usuariosCacheTela = await resp.json();
        mostrarUsuariosTela();
    } catch (e) {
        corpo.innerHTML = `<p class="ltVazio">Erro ao carregar usuários.</p>`;
    }
}

function filtrarUsuariosTela(filtro) {
    filtroUsuariosTela = filtro;
    document.querySelectorAll("#telaUsuarios .ltChip").forEach(b => b.classList.toggle("ltChipAtivo", b.dataset.filtro === filtro));
    mostrarUsuariosTela();
}

// iniciais + cor fixa por pessoa (a mesma cor sempre, calculada do login)
function avatarUsuario(u) {
    // só palavras que começam com letra (ignora símbolos e números soltos)
    let partes = String(u.nome || u.usuario || "").trim().split(/\s+/).filter(p => /^\p{L}/u.test(p));
    let iniciais = partes.length
        ? (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase()
        : "?";
    let cores = ["#60a5fa", "#a78bfa", "#22d3ee", "#34d399", "#fbbf24", "#fb923c", "#fb7185", "#a3e635"];
    let h = 0;
    for (let c of String(u.usuario || u.nome || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return { iniciais, cor: cores[h % cores.length] };
}

function mostrarUsuariosTela() {
    let corpo = document.getElementById("corpoTabelaUsuarios");
    if (!corpo) return;
    let esc = escaparHtmlPesagem;
    let I = ICONES_USUARIOS;
    let usuarios = usuariosCacheTela;

    let set = (id, v) => { let el = document.getElementById(id); if (el) el.innerText = v; };
    let ativos = usuarios.filter(u => u.ativo);
    set("usKpiAtivos", ativos.length);
    set("usKpiAdmins", ativos.filter(u => u.papel === "admin").length);
    set("usKpiOperadores", ativos.filter(u => u.papel !== "admin").length);
    set("usResumo", `${usuarios.length} ${usuarios.length === 1 ? "pessoa cadastrada" : "pessoas cadastradas"}`);

    let busca = (document.getElementById("usBusca")?.value || "").trim().toLowerCase();
    let lista = usuarios.filter(u => {
        if (busca && !(String(u.nome).toLowerCase().includes(busca) || String(u.usuario).toLowerCase().includes(busca))) return false;
        if (filtroUsuariosTela === "admin") return u.papel === "admin";
        if (filtroUsuariosTela === "operador") return u.papel !== "admin";
        if (filtroUsuariosTela === "inativos") return !u.ativo;
        return true;
    });
    // ativos primeiro, depois administradores, depois por nome
    lista.sort((a, b) => (b.ativo - a.ativo) || ((b.papel === "admin") - (a.papel === "admin")) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));

    if (lista.length === 0) {
        corpo.innerHTML = `<p class="ltVazio">${usuarios.length ? "Ninguém nesse filtro." : "Nenhum usuário cadastrado ainda."}</p>`;
        return;
    }
    let eu = localStorage.getItem("usuarioNome") || "";

    corpo.innerHTML = lista.map(u => {
        let admin = u.papel === "admin";
        let { iniciais, cor } = avatarUsuario(u);
        let perm = (icone, rotulo, valor) => `<div class="usPerm"><span class="usPermIcone">${I[icone]}</span><span class="usPermRotulo">${rotulo}</span><b>${valor}</b></div>`;
        let modulos = [
            u.permissaoAlmoxarifado ? `<span class="usModulo">${I.caixa}Almoxarifado</span>` : "",
            u.permissaoVacasMatriz ? `<span class="usModulo">${I.boi}Vacas Matriz</span>` : "",
            u.permissaoEditarNascimentos ? `<span class="usModulo">${I.lapis}Editar vacas/nascimentos</span>` : ""
        ].join("");
        let temLimite = u.valorMaximoCompra !== null && u.valorMaximoCompra !== undefined;
        return `
        <article class="usCartao${u.ativo ? "" : " usCartaoInativo"}${admin ? " usCartaoAdmin" : ""}">
            <header class="usCartaoTopo">
                <span class="usAvatar" style="--corAvatar:${cor}">${esc(iniciais)}</span>
                <div class="usIdentidade">
                    <h4 title="${esc(u.nome)}">${esc(u.nome)}${u.nome === eu ? ` <span class="usVoce">você</span>` : ""}</h4>
                    <span class="usLogin">@${esc(u.usuario)}</span>
                </div>
                <span class="ltStatus ${u.ativo ? "ltStatusAtivo" : "ltStatusInativo"}">${u.ativo ? "Ativo" : "Inativo"}</span>
            </header>
            <div class="usPapel ${admin ? "usPapelAdmin" : "usPapelOperador"}">${admin ? I.escudo : I.operador}<span>${admin ? "Administrador" : "Operador"}</span></div>
            <div class="usPermissoes">
                ${admin
                    ? `<p class="usAcessoTotal">${I.estrela}Acesso total ao sistema</p>`
                    : perm("balanca", "Pesagem", rotuloPermTipo(u.permissaoTipoPesagem))
                      + perm("grafico", "Dashboard", rotuloPermEscopo(u.permissaoDashboard))
                      + perm("relatorio", "Relatórios", rotuloPermEscopo(u.permissaoRelatorios))
                      + perm("dinheiro", "Máx. compra", temLimite ? formatarValorReais(u.valorMaximoCompra) : "sem limite")
                      + (modulos ? `<div class="usModulos">${modulos}</div>` : "")}
            </div>
            <footer class="ltCartaoAcoes">
                <button class="usBtnEditar" onclick='abrirModalUsuario(${jsonAtributo(u)})'>${I.editar}<span>Editar</span></button>
                <button class="ltBtnIcone ${u.ativo ? "ltBtnDesativar" : "ltBtnAtivar"}" onclick='alternarAtivoUsuario(${jsonAtributo(u.id)}, ${!u.ativo})' title="${u.ativo ? "Desativar acesso" : "Reativar acesso"}" aria-label="${u.ativo ? "Desativar acesso" : "Reativar acesso"}">${u.ativo ? I.desativar : I.ativar}</button>
                <button class="ltBtnIcone ltBtnExcluir" onclick='excluirUsuario(${jsonAtributo(u.id)}, ${jsonAtributo(u.nome)})' title="Excluir usuário" aria-label="Excluir usuário">${I.lixeira}</button>
            </footer>
        </article>`;
    }).join("");
}

function rotuloPermTipo(v) {
    if (v === "venda") return "Só Venda";
    if (v === "compra") return "Só Compra";
    return "Venda+Compra";
}

function rotuloPermEscopo(v) {
    return v === "proprio" ? "Próprio" : "Geral";
}

function formatarValorReais(n) {
    return "R$ " + formatarMoeda(n);
}

function alternarCamposPermissao() {
    let bloco = document.getElementById("blocoPermissoesUsuario");
    let ehAdmin = document.getElementById("usuarioPapelInput").value === "admin";
    if (bloco) bloco.style.display = ehAdmin ? "none" : "block";
}

function abrirModalUsuario(usuarioExistente) {
    usuarioEditandoId = usuarioExistente ? usuarioExistente.id : null;
    document.getElementById("modalUsuarioTitulo").innerText = usuarioEditandoId ? "✏️ Editar Usuário" : "➕ Novo Usuário";
    document.getElementById("usuarioNomeInput").value = usuarioExistente ? usuarioExistente.nome : "";
    document.getElementById("usuarioLoginInput").value = usuarioExistente ? usuarioExistente.usuario : "";
    document.getElementById("usuarioLoginInput").disabled = !!usuarioEditandoId;
    document.getElementById("usuarioSenhaInput").value = "";
    document.getElementById("usuarioSenhaInput").placeholder = usuarioEditandoId ? "Nova senha (deixe em branco pra manter)" : "Senha";
    document.getElementById("usuarioPapelInput").value = (usuarioExistente && usuarioExistente.papel) || "operador";
    document.getElementById("usuarioPermTipoInput").value = (usuarioExistente && usuarioExistente.permissaoTipoPesagem) || "ambos";
    document.getElementById("usuarioPermDashboardInput").value = (usuarioExistente && usuarioExistente.permissaoDashboard) || "geral";
    document.getElementById("usuarioPermRelatoriosInput").value = (usuarioExistente && usuarioExistente.permissaoRelatorios) || "geral";
    document.getElementById("usuarioValorMaxCompraInput").value = (usuarioExistente && usuarioExistente.valorMaximoCompra !== null && usuarioExistente.valorMaximoCompra !== undefined)
        ? String(usuarioExistente.valorMaximoCompra).replace(".", ",")
        : "";
    document.getElementById("usuarioPermAlmoxarifadoInput").checked = !!(usuarioExistente && usuarioExistente.permissaoAlmoxarifado);
    document.getElementById("usuarioPermVacasMatrizInput").checked = !!(usuarioExistente && usuarioExistente.permissaoVacasMatriz);
    document.getElementById("usuarioPermEditarNascimentosInput").checked = !!(usuarioExistente && usuarioExistente.permissaoEditarNascimentos);
    alternarCamposPermissao();
    let erroEl = document.getElementById("usuarioErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalUsuario").style.display = "flex";
}

function fecharModalUsuario() {
    document.getElementById("modalUsuario").style.display = "none";
    usuarioEditandoId = null;
}

async function salvarUsuario() {
    let erroEl = document.getElementById("usuarioErro");
    function mostrarErro(msg) {
        if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; }
    }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou. Feche este aviso e entre de novo."); return; }

        let nome = document.getElementById("usuarioNomeInput").value.trim();
        let usuario = document.getElementById("usuarioLoginInput").value.trim();
        let senha = document.getElementById("usuarioSenhaInput").value;
        let papel = document.getElementById("usuarioPapelInput").value;
        let permissaoTipoPesagem = document.getElementById("usuarioPermTipoInput").value;
        let permissaoDashboard = document.getElementById("usuarioPermDashboardInput").value;
        let permissaoRelatorios = document.getElementById("usuarioPermRelatoriosInput").value;
        let valorMaxTexto = document.getElementById("usuarioValorMaxCompraInput").value.trim();
        let valorMaximoCompra = valorMaxTexto ? parseFloat(valorMaxTexto.replace(/\./g, "").replace(",", ".")) : null;
        if (valorMaxTexto && !Number.isFinite(valorMaximoCompra)) {
            mostrarErro("Valor máximo de compra inválido.");
            return;
        }
        let permissaoAlmoxarifado = document.getElementById("usuarioPermAlmoxarifadoInput").checked;
        let permissaoVacasMatriz = document.getElementById("usuarioPermVacasMatrizInput").checked;
        let permissaoEditarNascimentos = document.getElementById("usuarioPermEditarNascimentosInput").checked;

        if (!nome || !usuario || (!usuarioEditandoId && !senha)) {
            mostrarErro("Preencha todos os campos.");
            return;
        }

        let resp;
        if (usuarioEditandoId) {
            let corpo = { nome, papel, permissaoTipoPesagem, permissaoDashboard, permissaoRelatorios, valorMaximoCompra, permissaoAlmoxarifado, permissaoVacasMatriz, permissaoEditarNascimentos };
            if (senha) corpo.senha = senha;
            resp = await fetch(`${API_URL}/api/usuarios/${usuarioEditandoId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(corpo)
            });
        } else {
            resp = await fetch(`${API_URL}/api/usuarios`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify({ nome, usuario, senha, papel, permissaoTipoPesagem, permissaoDashboard, permissaoRelatorios, valorMaximoCompra, permissaoAlmoxarifado, permissaoVacasMatriz, permissaoEditarNascimentos })
            });
        }
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            mostrarErro(dados.erro || `Erro ao salvar usuário (HTTP ${resp.status}).`);
            return;
        }
        fecharModalUsuario();
        carregarUsuarios();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function alternarAtivoUsuario(id, novoAtivo) {
    if (!await confirmarModerno(novoAtivo ? "Reativar este usuário?" : "Desativar este usuário? Ele não conseguirá mais entrar.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/usuarios/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            await alertarModerno(dados.erro || `Erro ao atualizar usuário (HTTP ${resp.status}).`);
            return;
        }
        carregarUsuarios();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

async function excluirUsuario(id, nome) {
    if (!await confirmarModerno(`Excluir o usuário "${nome}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/usuarios/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            await alertarModerno(dados.erro || `Erro ao excluir usuário (HTTP ${resp.status}).`);
            return;
        }
        carregarUsuarios();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ========================================
// MENSAGENS (aviso pro app do celular -- pra todos os usuários ativos ou
// só pra quem for marcado; vira uma bolinha de não-lida no sininho do
// menu mobile, sem push real -- ver [[project-pesocerto-mobile]])
// ========================================
function abrirModalMensagem() {
    document.getElementById("msgTextoInput").value = "";
    document.getElementById("msgDestinatarioTipoInput").value = "todos";
    let box = document.getElementById("msgListaUsuariosBox");
    box.style.display = "none";
    box.innerHTML = "";
    let erroEl = document.getElementById("msgErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalMensagem").style.display = "flex";
}

function fecharModalMensagem() {
    document.getElementById("modalMensagem").style.display = "none";
}

async function alternarListaDestinatariosMensagem() {
    let tipo = document.getElementById("msgDestinatarioTipoInput").value;
    let box = document.getElementById("msgListaUsuariosBox");
    if (tipo !== "especifico") {
        box.style.display = "none";
        return;
    }
    box.style.display = "block";
    box.innerHTML = `<p style="padding:8px 0">Carregando usuários...</p>`;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/usuarios`, { headers: { "Authorization": "Bearer " + token } });
        let usuarios = await resp.json();
        let ativos = usuarios.filter(u => u.ativo);
        if (ativos.length === 0) {
            box.innerHTML = `<p style="padding:8px 0">Nenhum usuário ativo.</p>`;
            return;
        }
        box.innerHTML = ativos.map(u => `
            <label class="linhaCheckboxCiente" style="margin-top:0">
                <input type="checkbox" value="${u.id}" class="msgDestinatarioCheckbox">
                <span>${u.nome} (${u.usuario})</span>
            </label>
        `).join("");
    } catch (e) {
        box.innerHTML = `<p style="padding:8px 0">Erro ao carregar usuários.</p>`;
    }
}

async function enviarMensagemAdmin() {
    let erroEl = document.getElementById("msgErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let texto = document.getElementById("msgTextoInput").value.trim();
        let tipo = document.getElementById("msgDestinatarioTipoInput").value;
        if (!texto) { mostrarErro("Escreva o texto da mensagem."); return; }

        let usuarioIds = [];
        if (tipo === "especifico") {
            usuarioIds = Array.from(document.querySelectorAll(".msgDestinatarioCheckbox:checked")).map(c => c.value);
            if (usuarioIds.length === 0) { mostrarErro("Selecione ao menos um destinatário."); return; }
        }

        let resp = await fetch(`${API_URL}/api/mensagens`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ texto, destinatarioTipo: tipo, usuarioIds })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao enviar (HTTP ${resp.status}).`); return; }

        fecharModalMensagem();
        await alertarModerno(`Mensagem enviada para ${dados.totalDestinatarios} usuário(s).`, { titulo: "✅ Enviado" });
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

// ========================================
// GERENCIAMENTO DE LOTES
// ========================================
let loteEditandoId = null;

// ícones próprios da tela de Lotes (traço fino, mesmo estilo do menu)
const ICONES_LOTES = {
    "mais": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"></path></svg>",
    "tag": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z\"></path><circle cx=\"7\" cy=\"7\" r=\"1.3\" fill=\"currentColor\"></circle></svg>",
    "boi": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 4c0 3 1.5 4.5 4 4.5h8c2.5 0 4-1.5 4-4.5\"></path><path d=\"M7 8.5v5a5 5 0 0 0 10 0v-5\"></path><path d=\"M9.5 17.5h5\"></path><circle cx=\"10\" cy=\"12\" r=\".7\" fill=\"currentColor\"></circle><circle cx=\"14\" cy=\"12\" r=\".7\" fill=\"currentColor\"></circle></svg>",
    "transf": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 7h13l-3-3\"></path><path d=\"M20 17H7l3 3\"></path></svg>",
    "busca": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"></line></svg>",
    "editar": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 20h9\"></path><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"></path></svg>",
    "desativar": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M5.6 5.6l12.8 12.8\"></path></svg>",
    "ativar": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M8.5 12l2.5 2.5 4.5-5\"></path></svg>",
    "lixeira": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 6h18\"></path><path d=\"M8 6V4h8v2\"></path><path d=\"M19 6l-1 14H6L5 6\"></path><path d=\"M10 11v6M14 11v6\"></path></svg>",
    "relatorio": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M13 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21H11\"></path><path d=\"M13 3l5 5v2.5\"></path><path d=\"M13 3v5h5\"></path><path d=\"M8 12h4M8 15.5h2\"></path><circle cx=\"16.5\" cy=\"16.5\" r=\"3\"></circle><path d=\"M18.7 18.7L21 21\"></path></svg>",
    "seta": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h14\"></path><path d=\"M13 6l6 6-6 6\"></path></svg>",
    "balanca": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3v18\"></path><path d=\"M5 7h14\"></path><path d=\"M5 7l-3 7a3 3 0 0 0 6 0z\"></path><path d=\"M19 7l-3 7a3 3 0 0 0 6 0z\"></path><path d=\"M8 21h8\"></path></svg>",
    "alerta": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z\"></path><path d=\"M12 9v4\"></path><path d=\"M12 17h.01\"></path></svg>",
    "desfazer": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 14L4 9l5-5\"></path><path d=\"M4 9h10.5a5.5 5.5 0 0 1 0 11H11\"></path></svg>"
};

let lotesCacheTela = [];
let filtroLotesTela = "ativos";

async function carregarLotes() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaLotes");
    if (!token || !corpo) return;

    try {
        let resp = await fetch(`${API_URL}/api/lotes`, {
            headers: { "Authorization": "Bearer " + token }
        });
        if (!resp.ok) {
            corpo.innerHTML = `<p class="ltVazio">Sessão expirada ou sem acesso.</p>`;
            return;
        }
        lotesCacheTela = await resp.json();
        mostrarLotesTela();
    } catch (e) {
        corpo.innerHTML = `<p class="ltVazio">Erro ao carregar lotes.</p>`;
    }
}

function filtrarLotesTela(filtro) {
    filtroLotesTela = filtro;
    document.querySelectorAll("#telaLotes .ltChip").forEach(b => b.classList.toggle("ltChipAtivo", b.dataset.filtro === filtro));
    mostrarLotesTela();
}

// quantas transferências cada lote recebeu/enviou (do histórico já carregado)
function contarTransferenciasDoLote(nome) {
    let recebidas = 0, enviadas = 0;
    transferenciasLotesCacheAdmin.forEach(t => {
        if (t.loteDestino === nome) recebidas++;
        if (t.loteOrigem === nome) enviadas++;
    });
    return { recebidas, enviadas };
}

function mostrarLotesTela() {
    let corpo = document.getElementById("corpoTabelaLotes");
    if (!corpo) return;
    let esc = escaparHtmlPesagem;
    let lotes = lotesCacheTela;
    let saldo = l => typeof l.saldo === "number" ? l.saldo : 0;
    let totalAnimais = lotes.filter(l => l.ativo).reduce((t, l) => t + saldo(l), 0);
    let maior = Math.max(1, ...lotes.map(saldo));

    let set = (id, v) => { let el = document.getElementById(id); if (el) el.innerText = v; };
    set("ltKpiAtivos", lotes.filter(l => l.ativo).length);
    set("ltKpiAnimais", totalAnimais);
    set("ltKpiTransf", transferenciasLotesCacheAdmin.length);
    set("ltResumo", `${lotes.length} ${lotes.length === 1 ? "lote cadastrado" : "lotes cadastrados"}`);

    let busca = (document.getElementById("ltBusca")?.value || "").trim().toLowerCase();
    let visiveis = lotes.filter(l => {
        if (busca && !l.nome.toLowerCase().includes(busca)) return false;
        if (filtroLotesTela === "ativos") return l.ativo;
        if (filtroLotesTela === "inativos") return !l.ativo;
        if (filtroLotesTela === "comAnimais") return saldo(l) > 0;
        if (filtroLotesTela === "vazios") return saldo(l) === 0;
        return true;
    });
    // os com mais animais primeiro; empate, ordem alfabética
    visiveis.sort((a, b) => saldo(b) - saldo(a) || a.nome.localeCompare(b.nome, "pt-BR"));

    if (lotes.length === 0) {
        corpo.innerHTML = `<p class="ltVazio">Nenhum lote cadastrado ainda. Clique em <b>Novo Lote</b> pra começar.</p>`;
        return;
    }
    if (visiveis.length === 0) {
        corpo.innerHTML = `<p class="ltVazio">Nenhum lote nesse filtro.</p>`;
        return;
    }

    let I = ICONES_LOTES;
    corpo.innerHTML = visiveis.map(l => {
        let n = saldo(l);
        let { recebidas, enviadas } = contarTransferenciasDoLote(l.nome);
        let participacao = totalAnimais > 0 && l.ativo ? Math.round(n / totalAnimais * 100) : 0;
        return `
        <article class="ltCartao${l.ativo ? "" : " ltCartaoInativo"}${n === 0 ? " ltCartaoVazio" : ""}">
            <header class="ltCartaoTopo">
                <span class="ltCartaoIcone">${I.tag}</span>
                <h4 title="${esc(l.nome)}">${esc(l.nome)}</h4>
                <span class="ltStatus ${l.ativo ? "ltStatusAtivo" : "ltStatusInativo"}">${l.ativo ? "Ativo" : "Inativo"}</span>
            </header>
            <div class="ltCartaoNumero">
                <b>${n}</b><span>${n === 1 ? "animal" : "animais"}</span>
                ${l.ativo && n > 0 ? `<small>${participacao}% do rebanho</small>` : ""}
            </div>
            <div class="ltBarra"><i style="width:${n > 0 ? Math.max(3, n / maior * 100) : 0}%"></i></div>
            <button class="ltCartaoTransf" onclick='verTransferenciasDoLote(${jsonAtributo(l.nome)})' title="Ver as transferências deste lote" ${recebidas + enviadas === 0 ? "disabled" : ""}>
                ${I.transf}<span>${recebidas + enviadas === 0 ? "Nenhuma transferência" : `${recebidas} recebida${recebidas === 1 ? "" : "s"} · ${enviadas} enviada${enviadas === 1 ? "" : "s"}`}</span>
            </button>
            <footer class="ltCartaoAcoes">
                <button class="ltBtnRelatorio" onclick='abrirRelatorioLoteDaTelaLotes(${jsonAtributo(l.nome)})'>${I.relatorio}<span>Ver relatório</span></button>
                <button class="ltBtnIcone" onclick='abrirModalLote(${jsonAtributo(l)})' title="Renomear lote" aria-label="Renomear lote">${I.editar}</button>
                <button class="ltBtnIcone ${l.ativo ? "ltBtnDesativar" : "ltBtnAtivar"}" onclick='alternarAtivoLote(${jsonAtributo(l.id)}, ${!l.ativo})' title="${l.ativo ? "Desativar lote" : "Reativar lote"}" aria-label="${l.ativo ? "Desativar lote" : "Reativar lote"}">${l.ativo ? I.desativar : I.ativar}</button>
                <button class="ltBtnIcone ltBtnExcluir" onclick='excluirLote(${jsonAtributo(l.id)}, ${jsonAtributo(l.nome)})' title="Excluir lote" aria-label="Excluir lote">${I.lixeira}</button>
            </footer>
        </article>`;
    }).join("");
}

// o relatório usa pesagens + caixa + almoxarifado + transferências: garante
// que estão carregados (na tela de Lotes o Dashboard pode nunca ter aberto)
async function abrirRelatorioLoteDaTelaLotes(nome) {
    await carregarCachesFinanceirasDashboard();
    await carregarTransferenciasLotesAdmin();
    abrirRelatorioLote(nome);
}

function verTransferenciasDoLote(nome) {
    let sel = document.getElementById("ltFiltroTransf");
    if (sel) sel.value = nome;
    mostrarHistoricoTransferencias();
    document.getElementById("ltHistorico")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function abrirModalLote(loteExistente) {
    loteEditandoId = loteExistente ? loteExistente.id : null;
    document.getElementById("modalLoteTitulo").innerText = loteEditandoId ? "✏️ Editar Lote" : "➕ Novo Lote";
    document.getElementById("loteNomeInput").value = loteExistente ? loteExistente.nome : "";
    let erroEl = document.getElementById("loteErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalLote").style.display = "flex";
}

function fecharModalLote() {
    document.getElementById("modalLote").style.display = "none";
    loteEditandoId = null;
}

async function salvarLote() {
    let erroEl = document.getElementById("loteErro");
    function mostrarErro(msg) {
        if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; }
    }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou. Feche este aviso e entre de novo."); return; }

        let nome = document.getElementById("loteNomeInput").value.trim();
        if (!nome) { mostrarErro("Informe o nome do lote."); return; }

        let resp;
        if (loteEditandoId) {
            resp = await fetch(`${API_URL}/api/lotes/${loteEditandoId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify({ nome })
            });
        } else {
            resp = await fetch(`${API_URL}/api/lotes`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify({ nome })
            });
        }
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            mostrarErro(dados.erro || `Erro ao salvar lote (HTTP ${resp.status}).`);
            return;
        }
        fecharModalLote();
        carregarLotes();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function alternarAtivoLote(id, novoAtivo) {
    if (!await confirmarModerno(novoAtivo ? "Reativar este lote?" : "Desativar este lote? Ele deixa de aparecer na lista do celular.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/lotes/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            await alertarModerno(dados.erro || `Erro ao atualizar lote (HTTP ${resp.status}).`);
            return;
        }
        carregarLotes();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

async function excluirLote(id, nome) {
    if (!await confirmarModerno(`Excluir o lote "${nome}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/lotes/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            await alertarModerno(dados.erro || `Erro ao excluir lote (HTTP ${resp.status}).`);
            return;
        }
        carregarLotes();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ========================================
// TRANSFERÊNCIA ENTRE LOTES
// ========================================
// Pra quem mistura o gado de várias compras no mesmo pasto (não dá pra
// separar lote por compra quando os animais ficam fisicamente juntos) —
// move cabeça e custo de um lote pro outro (ex: separar o refugo) sem
// inventar uma compra/venda que nunca aconteceu de verdade. Zero efeito em
// caixa: o custo sai de um lote e entra no outro pelo mesmo valor.
let transferenciasLotesCacheAdmin = [];

async function carregarTransferenciasLotesAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/transferencias-lotes`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        transferenciasLotesCacheAdmin = await resp.json();
        // o valor das transferências automáticas depende de insumos e
        // lançamentos do lote de origem (ver resolverValoresTransferencias)
        await Promise.all([carregarEstoqueSaidasAdmin(), carregarCaixaLancamentosAdmin()]);
        resolverValoresTransferencias(transferenciasLotesCacheAdmin, relatorios, estoqueSaidasCacheAdmin, caixaLancamentosCacheAdmin);
        return transferenciasLotesCacheAdmin;
    } catch (e) {
        return [];
    }
}

// chave de idempotência por modal financeiro aberto -- clicar "Salvar" de
// novo no MESMO modal (duplo toque, ou reenvio depois de um timeout numa
// conexão ruim) manda a mesma chave, então o servidor devolve o que já
// existe em vez de criar um segundo lançamento/conta/transferência pro
// mesmo envio. Só abrir o modal de novo (um registro novo) gera uma chave
// nova -- ver os 4 endpoints correspondentes em peso-api/server.js.
function novaChaveIdempotencia(modalId) {
    let modal = document.getElementById(modalId);
    if (modal) modal.dataset.idempKey = crypto.randomUUID();
}
function obterChaveIdempotencia(modalId) {
    let modal = document.getElementById(modalId);
    return (modal && modal.dataset.idempKey) || crypto.randomUUID();
}

async function abrirModalTransferenciaLote() {
    let token = obterToken();
    if (!token) return;

    let lotes = await fetch(`${API_URL}/api/lotes`, { headers: { "Authorization": "Bearer " + token } }).then(r => r.ok ? r.json() : []);
    let opcoes = `<option value="">Selecione o lote</option>` +
        lotes.filter(l => l.ativo).map(l => `<option value="${l.nome.replace(/"/g, "&quot;")}">${l.nome}</option>`).join("");
    document.getElementById("transfLoteOrigemInput").innerHTML = opcoes;
    document.getElementById("transfLoteDestinoInput").innerHTML = opcoes;

    document.getElementById("transfQuantidadeInput").value = "";
    document.getElementById("transfKgInput").value = "";
    document.getElementById("transfDataInput").value = new Date().toISOString().slice(0, 10);
    let erroEl = document.getElementById("transfErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    await atualizarPreviewTransferencia();
    novaChaveIdempotencia("modalTransferenciaLote");
    document.getElementById("modalTransferenciaLote").style.display = "flex";
}

// data escolhida + hora de agora (sem hora, a transferência de hoje ficaria
// ordenada ANTES da venda de hoje e pegaria o custo errado)
function dataTransferenciaModal() {
    let iso = document.getElementById("transfDataInput").value;
    let agora = new Date();
    if (!iso) return agora.toLocaleString("pt-BR");
    let [a, m, d] = iso.split("-");
    let hh = n => String(n).padStart(2, "0");
    return `${d}/${m}/${a}, ${hh(agora.getHours())}:${hh(agora.getMinutes())}:${hh(agora.getSeconds())}`;
}

function calcularPreviaTransferencia(loteOrigem, qtd, dataStr) {
    resolverValoresTransferencias(transferenciasLotesCacheAdmin, relatorios, estoqueSaidasCacheAdmin, caixaLancamentosCacheAdmin);
    let simulada = { loteOrigem, loteDestino: "", quantidade: qtd, data: dataStr, modoCusto: "automatico" };
    let est = estadoLoteAteTransferencia(loteOrigem, chaveOrdenacaoLoteMobile(dataStr) || "9999", simulada, transferenciasLotesCacheAdmin, relatorios, estoqueSaidasCacheAdmin, caixaLancamentosCacheAdmin);
    let restante = est.gasto - est.receita;
    let q = Math.min(qtd, est.headcount);
    let valor = est.headcount > 0 && restante > 0 ? Math.round(restante * q / est.headcount * 100) / 100 : 0;
    return { headcount: est.headcount, restante, valor };
}

async function atualizarPreviewTransferencia() {
    let preview = document.getElementById("transfPreview");
    if (!preview) return;
    let loteOrigem = document.getElementById("transfLoteOrigemInput").value;
    let qtd = parseFloat(document.getElementById("transfQuantidadeInput").value.replace(",", ".")) || 0;
    if (!loteOrigem) { preview.innerText = ""; return; }

    await carregarCachesFinanceirasDashboard();
    let previa = calcularPreviaTransferencia(loteOrigem, qtd, dataTransferenciaModal());
    let texto = `Animais em "${loteOrigem}": ${previa.headcount}. `;
    texto += previa.restante > 0
        ? `Ainda falta recuperar R$ ${formatarMoeda(previa.restante)} desse lote em vendas (R$ ${formatarMoeda(previa.restante / Math.max(previa.headcount, 1))} por animal).`
        : `Esse lote já recuperou todo o investimento${previa.restante < 0 ? " e tem R$ " + formatarMoeda(-previa.restante) + " de lucro, que fica nele" : ""}.`;
    if (qtd > 0) texto += ` → Os ${qtd} animal(is) vão com custo de R$ ${formatarMoeda(previa.valor)}.`;
    preview.innerText = texto;
}

function fecharModalTransferenciaLote() {
    document.getElementById("modalTransferenciaLote").style.display = "none";
}

async function confirmarTransferenciaLote() {
    let erroEl = document.getElementById("transfErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let loteOrigem = document.getElementById("transfLoteOrigemInput").value;
        let loteDestino = document.getElementById("transfLoteDestinoInput").value;
        let quantidade = parseFloat(document.getElementById("transfQuantidadeInput").value.replace(",", "."));
        let dataISOSimples = document.getElementById("transfDataInput").value;

        if (!loteOrigem) { mostrarErro("Selecione o lote de origem."); return; }
        if (!loteDestino) { mostrarErro("Selecione o lote de destino."); return; }
        if (loteOrigem === loteDestino) { mostrarErro("Origem e destino não podem ser o mesmo lote."); return; }
        if (!Number.isFinite(quantidade) || quantidade <= 0) { mostrarErro("Quantidade inválida."); return; }

        let previa = calcularPreviaTransferencia(loteOrigem, quantidade, dataTransferenciaModal());
        if (quantidade > previa.headcount) { mostrarErro(`O lote "${loteOrigem}" tem só ${previa.headcount} animal(is) no saldo.`); return; }

        let kgTexto = document.getElementById("transfKgInput").value.trim();
        let kgTotal = kgTexto ? parseFloat(kgTexto.replace(/\./g, "").replace(",", ".")) : null;
        if (kgTexto && (!Number.isFinite(kgTotal) || kgTotal <= 0)) { mostrarErro("Peso total inválido."); return; }

        // custo calculado nos relatórios (só o que a origem ainda não
        // recuperou -- ver resolverValoresTransferencias em app.js)
        let resp = await fetch(`${API_URL}/api/transferencias-lotes`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ id: obterChaveIdempotencia("modalTransferenciaLote"), loteOrigem, loteDestino, quantidade, modoCusto: "automatico", kgTotal, data: dataTransferenciaModal() })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao transferir (HTTP ${resp.status}).`); return; }

        fecharModalTransferenciaLote();
        await atualizarTelasAposMudancaDeLote();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function carregarHistoricoTransferencias() {
    let corpo = document.getElementById("corpoTabelaTransferencias");
    if (!corpo) return;
    await carregarTransferenciasLotesAdmin();
    mostrarHistoricoTransferencias();
    mostrarLotesTela(); // contadores de transferência nos cartões
}

function mostrarHistoricoTransferencias() {
    let corpo = document.getElementById("corpoTabelaTransferencias");
    if (!corpo) return;
    let esc = escaparHtmlPesagem;
    let I = ICONES_LOTES;

    // filtro por lote: só os lotes que aparecem em alguma transferência
    let sel = document.getElementById("ltFiltroTransf");
    let nomes = [...new Set(transferenciasLotesCacheAdmin.flatMap(t => [t.loteOrigem, t.loteDestino]))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    let filtro = sel ? sel.value : "";
    if (sel) {
        sel.innerHTML = `<option value="">Todos os lotes</option>` + nomes.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
        sel.value = nomes.includes(filtro) ? filtro : "";
        filtro = sel.value;
        sel.classList.toggle("ltFiltroUsado", !!filtro);
    }
    let lista = transferenciasLotesCacheAdmin.filter(t => !filtro || t.loteOrigem === filtro || t.loteDestino === filtro);

    if (lista.length === 0) {
        corpo.innerHTML = `<p class="ltVazio">${filtro ? "Nenhuma transferência deste lote." : "Nenhuma transferência registrada ainda."}</p>`;
        return;
    }
    corpo.innerHTML = lista.map(t => {
        let [dia, hora] = String(t.data || "—").split(",");
        let pesada = Array.isArray(t.pesos) && t.pesos.length > 0;
        let destaque = nome => filtro && nome === filtro ? " ltLoteDestaque" : "";
        return `
        <div class="ltEvento">
            <div class="ltEventoData"><b>${esc(dia)}</b><small>${esc((hora || "").trim().slice(0, 5))}</small></div>
            <div class="ltEventoMarcador" aria-hidden="true"></div>
            <div class="ltEventoCorpo">
                <div class="ltEventoRota">
                    <span class="ltLote${destaque(t.loteOrigem)}">${esc(t.loteOrigem)}</span>
                    <span class="ltEventoSeta">${I.seta}</span>
                    <span class="ltLote${destaque(t.loteDestino)}">${esc(t.loteDestino)}</span>
                </div>
                <div class="ltEventoInfo">
                    <span class="ltSelo">${t.quantidade} ${t.quantidade === 1 ? "animal" : "animais"}</span>
                    ${pesada || t.kgTotal
                        ? `<span class="ltSelo ltSeloPesada">${I.balanca}${formatarPeso(t.kgTotal)} kg</span>`
                        : `<span class="ltSelo ltSeloSemPeso" title="Lançada antes da regra de transferir só pesando">${I.alerta}sem peso</span>`}
                    <span class="ltEventoValor">R$ ${formatarMoeda(t.valorTotal)}</span>
                    <small class="ltEventoModo" title="${t.modoCusto === "automatico" ? "Calculado: só o custo que o lote de origem ainda não tinha recuperado" : "Valor informado na hora"}">${t.modoCusto === "automatico" ? "custo automático" : "custo manual"}</small>
                </div>
            </div>
            <button class="ltBtnDesfazer" onclick='excluirTransferenciaLote(${jsonAtributo(t.id)})' title="Desfazer: os animais voltam pro lote de origem">${I.desfazer}<span>Desfazer</span></button>
        </div>`;
    }).join("");
}

async function excluirTransferenciaLote(id) {
    if (!await confirmarModerno("Desfazer esta transferência? Os animais voltam pro lote de origem.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/transferencias-lotes/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await atualizarTelasAposMudancaDeLote();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// depois de criar ou desfazer uma transferência, todo relatório que
// depende de headcount/custo por lote precisa recarregar — a lista é a
// mesma que já existe pra quando um lançamento de caixa muda.
async function atualizarTelasAposMudancaDeLote() {
    await carregarHistoricoTransferencias();
    if (typeof mostrarPatrimonio === "function") mostrarPatrimonio();
    if (typeof mostrarEvolucaoPatrimonio === "function") mostrarEvolucaoPatrimonio();
    if (typeof mostrarResultadoMensal === "function") mostrarResultadoMensal();
    if (typeof mostrarCustoPorLote === "function") mostrarCustoPorLote();
}

// ========================================
// ALMOXARIFADO — DEPARTAMENTOS
// ========================================
let departamentosCacheAdmin = [];

async function carregarDepartamentosAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/departamentos`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        departamentosCacheAdmin = await resp.json();
        return departamentosCacheAdmin;
    } catch (e) {
        return [];
    }
}

function preencherSelectDepartamentos(select, valorSelecionado) {
    if (!select) return;
    select.innerHTML = `<option value="">Sem departamento</option>` +
        departamentosCacheAdmin.filter(d => d.ativo).map(d => `<option value="${d.id}">${d.nome}</option>`).join("");
    select.value = valorSelecionado || "";
}

async function abrirModalDepartamento() {
    await carregarDepartamentosModal();
    let erroEl = document.getElementById("departamentoErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("departamentoNomeInput").value = "";
    document.getElementById("modalDepartamento").style.display = "flex";
}

function fecharModalDepartamento() {
    document.getElementById("modalDepartamento").style.display = "none";
    // reflete no select do modal de produto qualquer mudança feita aqui (novo/desativado)
    let selectProduto = document.getElementById("produtoDepartamentoInput");
    if (selectProduto) preencherSelectDepartamentos(selectProduto, selectProduto.value);
}

async function carregarDepartamentosModal() {
    let token = obterToken();
    let lista = document.getElementById("listaDepartamentosModal");
    if (!token || !lista) return;
    await carregarDepartamentosAdmin();
    if (departamentosCacheAdmin.length === 0) {
        lista.innerHTML = `<p style="font-size:13px;color:#999;padding:8px 0">Nenhum departamento cadastrado ainda.</p>`;
        return;
    }
    lista.innerHTML = departamentosCacheAdmin.map(d => `
        <div class="itemDepartamentoModal">
            <span>${d.nome}${d.ativo ? "" : " (inativo)"}</span>
            <span>
                <button onclick='alternarAtivoDepartamento(${jsonAtributo(d.id)}, ${!d.ativo})'>${d.ativo ? "🚫" : "✅"}</button>
                <button onclick='excluirDepartamento(${jsonAtributo(d.id)}, ${jsonAtributo(d.nome)})'>🗑️</button>
            </span>
        </div>
    `).join("");
}

async function salvarDepartamento() {
    let erroEl = document.getElementById("departamentoErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }
    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }
        let nome = document.getElementById("departamentoNomeInput").value.trim();
        if (!nome) { mostrarErro("Informe o nome do departamento."); return; }
        let resp = await fetch(`${API_URL}/api/departamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ nome })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao criar departamento (HTTP ${resp.status}).`); return; }
        document.getElementById("departamentoNomeInput").value = "";
        await carregarDepartamentosModal();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function alternarAtivoDepartamento(id, novoAtivo) {
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/departamentos/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao atualizar departamento (HTTP ${resp.status}).`); return; }
        await carregarDepartamentosModal();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

async function excluirDepartamento(id, nome) {
    if (!await confirmarModerno(`Excluir o departamento "${nome}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/departamentos/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir departamento (HTTP ${resp.status}).`); return; }
        await carregarDepartamentosModal();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ========================================
// ALMOXARIFADO — PRODUTOS
// ========================================
let produtoEditandoId = null;
let produtosCacheAdmin = [];

async function carregarProdutosAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/produtos`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        produtosCacheAdmin = await resp.json();
        return produtosCacheAdmin;
    } catch (e) {
        return [];
    }
}

// visão geral do Almoxarifado (tela hub) — quantos produtos, quanto dinheiro
// está parado em estoque e quais produtos zeraram, pra saber o que repor
// sem precisar entrar em Produtos e ler linha por linha.
const ICONES_ALMOX = {
    "caixa": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\"></path><polyline points=\"3.27 6.96 12 12.01 20.73 6.96\"></polyline><line x1=\"12\" y1=\"22.08\" x2=\"12\" y2=\"12\"></line></svg>",
    "tag": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z\"></path><circle cx=\"7\" cy=\"7\" r=\"1.3\" fill=\"currentColor\"></circle></svg>",
    "entrada": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5\"></path><path d=\"M12 3v11\"></path><path d=\"M8 10l4 4 4-4\"></path></svg>",
    "saida": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5\"></path><path d=\"M12 14V3\"></path><path d=\"M8 7l4-4 4 4\"></path></svg>",
    "seta": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 6l6 6-6 6\"></path></svg>",
    "dinheiro": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" rx=\"2\"></rect><circle cx=\"12\" cy=\"12\" r=\"2.5\"></circle><path d=\"M6 12h.01M18 12h.01\"></path></svg>",
    "alerta": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z\"></path><path d=\"M12 9v4\"></path><path d=\"M12 17h.01\"></path></svg>",
    "trofeu": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 21h8M12 17v4\"></path><path d=\"M7 4h10v5a5 5 0 0 1-10 0z\"></path><path d=\"M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3\"></path></svg>",
    "busca": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"></line></svg>",
    "mais": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"></path></svg>",
    "grafico": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 3v18h18\"></path><path d=\"M7 15l4-4 3 3 5-6\"></path></svg>"
};
let filtroProdutosAlmox = "todos";

async function mostrarDashboardProdutos() {
    let elAtivos = document.getElementById("almoxProdutosAtivos");
    let corpo = document.getElementById("corpoTabelaDashboardProdutos");
    if (!elAtivos || !corpo) return;

    await carregarProdutosAdmin();
    let ativos = produtosCacheAdmin.filter(p => p.ativo);
    let valorDe = p => (p.saldoAtual || 0) * (p.custoMedioUnitario || 0);

    let valorTotalEstoque = ativos.reduce((soma, p) => soma + valorDe(p), 0);
    let semEstoque = ativos.filter(p => (p.saldoAtual || 0) <= 0).length;
    let maior = [...ativos].sort((a, b) => valorDe(b) - valorDe(a))[0];

    elAtivos.innerText = ativos.length;
    document.getElementById("almoxValorEstoque").innerText = "R$ " + formatarMoeda(valorTotalEstoque);
    document.getElementById("almoxSemEstoque").innerText = semEstoque;
    document.querySelector(".almKpiSemEstoque")?.classList.toggle("almKpiAlerta", semEstoque > 0);
    let elMaior = document.getElementById("almoxMaiorValor");
    if (elMaior) {
        elMaior.innerText = maior && valorDe(maior) > 0 ? maior.descricao : "—";
        elMaior.title = maior && valorDe(maior) > 0 ? `${maior.descricao}: R$ ${formatarMoeda(valorDe(maior))}` : "";
    }
    let elResumo = document.getElementById("almResumo");
    if (elResumo) elResumo.innerText = `${ativos.length} ${ativos.length === 1 ? "produto ativo" : "produtos ativos"} · R$ ${formatarMoeda(valorTotalEstoque)} em estoque`;

    // departamentos que existem nos produtos ativos (mantém a escolha)
    let sel = document.getElementById("almFiltroDepto");
    if (sel) {
        let atual = sel.value;
        let deptos = [...new Set(ativos.map(p => p.departamentoNome).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        sel.innerHTML = `<option value="">Departamento: Todos</option>` + deptos.map(d => `<option value="${escaparHtmlPesagem(d)}">${escaparHtmlPesagem(d)}</option>`).join("");
        sel.value = deptos.includes(atual) ? atual : "";
    }
    mostrarListaProdutosAlmox();
}

function filtrarProdutosAlmox(filtro, rolarAteLista) {
    filtroProdutosAlmox = filtro;
    document.querySelectorAll("#telaAlmoxarifado .ltChip").forEach(b => b.classList.toggle("ltChipAtivo", b.dataset.filtro === filtro));
    mostrarListaProdutosAlmox();
    if (rolarAteLista) document.getElementById("almLista")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function mostrarListaProdutosAlmox() {
    let corpo = document.getElementById("corpoTabelaDashboardProdutos");
    if (!corpo) return;
    let esc = escaparHtmlPesagem;
    let ativos = produtosCacheAdmin.filter(p => p.ativo);
    let valorDe = p => (p.saldoAtual || 0) * (p.custoMedioUnitario || 0);
    let total = ativos.reduce((s, p) => s + valorDe(p), 0);

    if (ativos.length === 0) {
        corpo.innerHTML = `<p class="ltVazio">Nenhum produto ativo cadastrado ainda.</p>`;
        return;
    }
    let busca = (document.getElementById("almBusca")?.value || "").trim().toLowerCase();
    let depto = document.getElementById("almFiltroDepto")?.value || "";
    document.getElementById("almFiltroDepto")?.classList.toggle("ltFiltroUsado", !!depto);
    let lista = ativos.filter(p => {
        let semEst = (p.saldoAtual || 0) <= 0;
        if (filtroProdutosAlmox === "semEstoque" && !semEst) return false;
        if (filtroProdutosAlmox === "comEstoque" && semEst) return false;
        if (depto && p.departamentoNome !== depto) return false;
        if (busca && !String(p.descricao).toLowerCase().includes(busca)) return false;
        return true;
    }).sort((a, b) => valorDe(b) - valorDe(a));

    if (lista.length === 0) {
        corpo.innerHTML = `<p class="ltVazio">Nenhum produto nesse filtro.</p>`;
        return;
    }
    let I = ICONES_ALMOX;
    corpo.innerHTML = lista.map(p => {
        let valor = valorDe(p);
        let semEst = (p.saldoAtual || 0) <= 0;
        let parte = total > 0 ? valor / total * 100 : 0;
        return `
        <div class="almLinha${semEst ? " almLinhaSemEstoque" : ""}">
            <div class="almProduto">
                <span class="almProdutoIcone">${semEst ? I.alerta : I.caixa}</span>
                <div class="almProdutoTextos">
                    <b title="${esc(p.descricao)}">${esc(p.descricao)}</b>
                    <small>${p.departamentoNome ? esc(p.departamentoNome) : "sem departamento"}</small>
                </div>
            </div>
            <div class="almSaldo" data-rotulo="Saldo">
                ${semEst ? `<span class="almRepor">Repor</span>` : ""}
                <b>${formatarPeso(p.saldoAtual)}</b> <small>${esc(p.unidade || "")}</small>
            </div>
            <div class="almCusto" data-rotulo="Custo médio">R$ ${formatarMoeda(p.custoMedioUnitario)}<small> /${esc(p.unidade || "un")}</small></div>
            <div class="almValor" data-rotulo="Valor em estoque">
                <div class="almValorLinha"><b>R$ ${formatarMoeda(valor)}</b><small>${parte >= 0.5 ? Math.round(parte) + "%" : (valor > 0 ? "<1%" : "")}</small></div>
                <div class="almBarra"><i style="width:${valor > 0 ? Math.max(2, parte) : 0}%"></i></div>
            </div>
        </div>`;
    }).join("");
}

async function carregarProdutos() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaProdutos");
    if (!token || !corpo) return;

    await carregarDepartamentosAdmin();
    await carregarProdutosAdmin();
    if (produtosCacheAdmin.length === 0) {
        corpo.innerHTML = `<tr><td colspan="8">Nenhum produto cadastrado ainda.</td></tr>`;
        return;
    }
    corpo.innerHTML = produtosCacheAdmin.map(p => `
        <tr>
            <td>${escaparHtmlPesagem(p.descricao)}</td>
            <td>${p.codigoBarra || "—"}</td>
            <td>${p.departamentoNome || "—"}</td>
            <td>${p.unidade}</td>
            <td>${formatarPeso(p.saldoAtual)}</td>
            <td>R$ ${formatarMoeda(p.custoMedioUnitario)}</td>
            <td>${p.ativo ? "✅ Ativo" : "🚫 Inativo"}</td>
            <td class="acoesUsuario">
                <button onclick='abrirModalProduto(${jsonAtributo(p)})'>✏️</button>
                <button onclick='alternarAtivoProduto(${jsonAtributo(p.id)}, ${!p.ativo})'>${p.ativo ? "🚫" : "✅"}</button>
                <button onclick='excluirProduto(${jsonAtributo(p.id)}, ${jsonAtributo(p.descricao)})'>🗑️</button>
            </td>
        </tr>
    `).join("");
}

async function abrirModalProduto(produtoExistente) {
    await carregarDepartamentosAdmin();
    produtoEditandoId = produtoExistente ? produtoExistente.id : null;
    document.getElementById("modalProdutoTitulo").innerText = produtoEditandoId ? "✏️ Editar Produto" : "➕ Novo Produto";
    document.getElementById("produtoDescricaoInput").value = produtoExistente ? produtoExistente.descricao : "";
    document.getElementById("produtoCodigoBarraInput").value = produtoExistente ? (produtoExistente.codigoBarra || "") : "";
    document.getElementById("produtoUnidadeInput").value = produtoExistente ? produtoExistente.unidade : "";
    preencherSelectDepartamentos(document.getElementById("produtoDepartamentoInput"), produtoExistente ? produtoExistente.departamentoId : "");
    let erroEl = document.getElementById("produtoErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalProduto").style.display = "flex";
}

function fecharModalProduto() {
    document.getElementById("modalProduto").style.display = "none";
    produtoEditandoId = null;
}

async function salvarProduto() {
    let erroEl = document.getElementById("produtoErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou. Feche este aviso e entre de novo."); return; }

        let descricao = document.getElementById("produtoDescricaoInput").value.trim();
        let codigoBarra = document.getElementById("produtoCodigoBarraInput").value.trim();
        let departamentoId = document.getElementById("produtoDepartamentoInput").value;
        let unidade = document.getElementById("produtoUnidadeInput").value.trim();

        if (!descricao) { mostrarErro("Informe a descrição do produto."); return; }

        let corpo = { descricao, codigoBarra: codigoBarra || null, departamentoId: departamentoId || null, unidade: unidade || "unidade" };
        let resp;
        if (produtoEditandoId) {
            resp = await fetch(`${API_URL}/api/produtos/${produtoEditandoId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(corpo)
            });
        } else {
            resp = await fetch(`${API_URL}/api/produtos`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(corpo)
            });
        }
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar produto (HTTP ${resp.status}).`); return; }
        fecharModalProduto();
        carregarProdutos();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function alternarAtivoProduto(id, novoAtivo) {
    if (!await confirmarModerno(novoAtivo ? "Reativar este produto?" : "Desativar este produto? Ele deixa de aparecer pra seleção de estoque/saída.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/produtos/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao atualizar produto (HTTP ${resp.status}).`); return; }
        carregarProdutos();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

async function excluirProduto(id, descricao) {
    if (!await confirmarModerno(`Excluir o produto "${descricao}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/produtos/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir produto (HTTP ${resp.status}).`); return; }
        carregarProdutos();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ========================================
// ALMOXARIFADO — ESTOQUE (ENTRADAS)
// ========================================
async function carregarEstoque() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaEstoqueSaldo");
    if (!token || !corpo) return;
    await Promise.all([carregarProdutosAdmin(), carregarEstoqueEntradasAdmin()]);
    let ativos = produtosCacheAdmin.filter(p => p.ativo);
    if (ativos.length === 0) {
        corpo.innerHTML = `<tr><td colspan="3">Nenhum produto ativo cadastrado ainda.</td></tr>`;
    } else {
        corpo.innerHTML = ativos.map(p => `
            <tr>
                <td>${escaparHtmlPesagem(p.descricao)}</td>
                <td>${formatarPeso(p.saldoAtual)} ${p.unidade}</td>
                <td>R$ ${formatarMoeda(p.custoMedioUnitario)}</td>
            </tr>
        `).join("");
    }
    mostrarHistoricoEntradas();
}

// Entrada de estoque não mexe no Fluxo de Caixa (ver calcularCaixaAcumulado)
// -- é só um registro físico do que chegou. Corrigir/excluir uma entrada
// errada é feito aqui, na tela de Estoque, não mais no Fluxo de Caixa.
function mostrarHistoricoEntradas() {
    let corpo = document.getElementById("corpoTabelaHistoricoEntradas");
    if (!corpo) return;
    if (estoqueEntradasCacheAdmin.length === 0) {
        corpo.innerHTML = `<tr><td colspan="7">Nenhuma entrada registrada ainda.</td></tr>`;
        return;
    }
    corpo.innerHTML = estoqueEntradasCacheAdmin.map(e => `
        <tr>
            <td>${e.data ? e.data.split(",")[0] : "—"}</td>
            <td>${e.produtoDescricao}</td>
            <td>${formatarPeso(e.quantidade)}</td>
            <td>R$ ${formatarMoeda(e.valorUnitario)}</td>
            <td>R$ ${formatarMoeda(e.valorTotal)}</td>
            <td>${e.numeroNota || "—"}</td>
            <td class="acoesUsuario"><button onclick='excluirEntradaEstoque(${jsonAtributo(e.id)}, ${jsonAtributo(e.produtoDescricao)})'>🗑️</button></td>
        </tr>
    `).join("");
}

async function abrirModalEstoqueEntrada() {
    await carregarProdutosAdmin();
    let select = document.getElementById("entradaProdutoInput");
    select.innerHTML = `<option value="">Selecione o produto</option>` +
        produtosCacheAdmin.filter(p => p.ativo).map(p => `<option value="${p.id}">${escaparHtmlPesagem(p.descricao)}</option>`).join("");
    document.getElementById("entradaQuantidadeInput").value = "";
    document.getElementById("entradaValorUnitarioInput").value = "";
    document.getElementById("entradaNumeroNotaInput").value = "";
    atualizarPreviewEntrada();
    let erroEl = document.getElementById("entradaErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalEstoqueEntrada").style.display = "flex";
}

function fecharModalEstoqueEntrada() {
    document.getElementById("modalEstoqueEntrada").style.display = "none";
}

function atualizarPreviewEntrada() {
    let qtd = parseFloat(document.getElementById("entradaQuantidadeInput").value.replace(",", ".")) || 0;
    let valorUnit = parseFloat(document.getElementById("entradaValorUnitarioInput").value.replace(",", ".")) || 0;
    let preview = document.getElementById("entradaPreviewTotal");
    if (preview) preview.innerText = (qtd > 0 && valorUnit > 0) ? `Total: R$ ${formatarMoeda(qtd * valorUnit)}` : "";
}

async function salvarEstoqueEntrada() {
    let erroEl = document.getElementById("entradaErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }
    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let produtoId = document.getElementById("entradaProdutoInput").value;
        let quantidade = parseFloat(document.getElementById("entradaQuantidadeInput").value.replace(",", "."));
        let valorUnitario = parseFloat(document.getElementById("entradaValorUnitarioInput").value.replace(",", "."));
        let numeroNota = document.getElementById("entradaNumeroNotaInput").value.trim();

        if (!produtoId) { mostrarErro("Selecione um produto."); return; }
        if (!Number.isFinite(quantidade) || quantidade <= 0) { mostrarErro("Quantidade inválida."); return; }
        if (!Number.isFinite(valorUnitario) || valorUnitario < 0) { mostrarErro("Valor unitário inválido."); return; }

        let resp = await fetch(`${API_URL}/api/estoque-entradas`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ produtoId, quantidade, valorUnitario, numeroNota: numeroNota || null, data: new Date().toLocaleString("pt-BR") })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao registrar entrada (HTTP ${resp.status}).`); return; }
        fecharModalEstoqueEntrada();
        carregarEstoque();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

// ========================================
// ALMOXARIFADO — SAÍDA DE ESTOQUE (DESKTOP)
// ========================================
let estoqueSaidasCacheAdmin = [];

async function carregarEstoqueSaidasAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/estoque-saidas`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        estoqueSaidasCacheAdmin = await resp.json();
        return estoqueSaidasCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function abrirTelaSaidaEstoqueDesktop() {
    let token = obterToken();
    if (!token) return;

    let lotes = await fetch(`${API_URL}/api/lotes`, { headers: { "Authorization": "Bearer " + token } }).then(r => r.ok ? r.json() : []);
    await carregarProdutosAdmin();

    let selectLote = document.getElementById("saidaLoteInput");
    selectLote.innerHTML = `<option value="">Selecione o lote</option>` +
        lotes.filter(l => l.ativo).map(l => `<option value="${l.nome.replace(/"/g, "&quot;")}">${l.nome}</option>`).join("");

    let selectProduto = document.getElementById("saidaProdutoInput");
    selectProduto.innerHTML = `<option value="">Selecione o produto</option>` +
        produtosCacheAdmin.filter(p => p.ativo).map(p => `<option value="${p.id}">${escaparHtmlPesagem(p.descricao)}</option>`).join("");

    document.getElementById("saidaQuantidadeInput").value = "";
    let erroEl = document.getElementById("saidaErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    atualizarPreviewSaidaDesktop();
    carregarHistoricoSaidas();
}

function atualizarPreviewSaidaDesktop() {
    let produtoId = document.getElementById("saidaProdutoInput").value;
    let qtd = parseFloat(document.getElementById("saidaQuantidadeInput").value.replace(",", ".")) || 0;
    let preview = document.getElementById("saidaPreview");
    if (!preview) return;

    let produto = produtosCacheAdmin.find(p => p.id === produtoId);
    if (!produto) { preview.innerText = ""; return; }

    let texto = `Estoque disponível: ${formatarPeso(produto.saldoAtual)} ${produto.unidade} · Custo médio: R$ ${formatarMoeda(produto.custoMedioUnitario)}`;
    if (qtd > 0) texto += ` · Total estimado: R$ ${formatarMoeda(qtd * produto.custoMedioUnitario)}`;
    preview.innerText = texto;
}

async function confirmarSaidaEstoqueDesktop() {
    let erroEl = document.getElementById("saidaErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let loteNome = document.getElementById("saidaLoteInput").value;
        let produtoId = document.getElementById("saidaProdutoInput").value;
        let quantidade = parseFloat(document.getElementById("saidaQuantidadeInput").value.replace(",", "."));

        if (!loteNome) { mostrarErro("Selecione o lote."); return; }
        if (!produtoId) { mostrarErro("Selecione o produto."); return; }
        if (!Number.isFinite(quantidade) || quantidade <= 0) { mostrarErro("Quantidade inválida."); return; }

        let id = crypto.randomUUID();
        let resp = await fetch(`${API_URL}/api/estoque-saidas/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ saidas: [{ id, produtoId, loteNome, quantidade, data: new Date().toLocaleString("pt-BR") }] })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao registrar saída (HTTP ${resp.status}).`); return; }
        if (dados.idsRejeitados && dados.idsRejeitados.includes(id)) {
            mostrarErro("Estoque insuficiente para essa saída.");
            return;
        }

        document.getElementById("saidaQuantidadeInput").value = "";
        await carregarProdutosAdmin();
        atualizarPreviewSaidaDesktop();
        await carregarHistoricoSaidas();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function carregarHistoricoSaidas() {
    let corpo = document.getElementById("corpoTabelaSaidas");
    if (!corpo) return;
    await carregarEstoqueSaidasAdmin();
    if (estoqueSaidasCacheAdmin.length === 0) {
        corpo.innerHTML = `<tr><td colspan="7">Nenhuma saída registrada ainda.</td></tr>`;
        return;
    }
    corpo.innerHTML = estoqueSaidasCacheAdmin.map(s => `
        <tr>
            <td>${s.data || "—"}</td>
            <td>${s.produtoDescricao}</td>
            <td>${escaparHtmlPesagem(s.loteNome)}</td>
            <td>${formatarPeso(s.quantidade)}</td>
            <td>R$ ${formatarMoeda(s.valorTotal)}</td>
            <td>${escaparHtmlPesagem(s.criadoPor || "—")}</td>
            <td class="acoesUsuario"><button onclick='excluirEstoqueSaida(${jsonAtributo(s.id)})'>🗑️</button></td>
        </tr>
    `).join("");
}

async function excluirEstoqueSaida(id) {
    if (!await confirmarModerno("Excluir esta saída? O estoque do produto volta a ficar disponível.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/estoque-saidas/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir saída (HTTP ${resp.status}).`); return; }
        await carregarProdutosAdmin();
        carregarHistoricoSaidas();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ========================================
// ALMOXARIFADO — CUSTO POR LOTE
// ========================================
// Acha a data (ISO "yyyy-mm-dd") em que o CICLO ATUAL de um lote começou --
// ou seja, a última vez que ele recebeu animais (compra ou transferência de
// entrada) depois de ter ficado com 0 cabeças. Sem isso, um lote que já foi
// vendido por completo (lucro/prejuízo já realizado) e depois é reaproveitado
// pra uma compra nova com o MESMO nome continuaria arrastando pra sempre o
// resultado do ciclo antigo, distorcendo a decisão sobre o lote em andamento.
// Retorna null quando não dá pra detectar ciclo (sem data válida em nenhum
// evento) -- nesse caso o chamador deve considerar o histórico inteiro.
// horário completo (quando disponível) só pra desempatar corretamente dois
// eventos no mesmo dia -- extrairDataISO() só dá o dia. Compartilhada com os
// filtros de ciclo abaixo (dentroDoCicloAtual/noCicloAtual): antes cada um
// comparava só o dia, então um lote fechado (vendido até 0) e reaberto no
// MESMO DIA com uma compra nova misturava a venda de fechamento do ciclo
// antigo dentro do ciclo novo (as duas datas "empatavam" no dia).
function chaveOrdenacaoLote(dataStr) {
    let m = String(dataStr || "").match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}` : extrairDataISO(dataStr);
}

// dataISOLimite (opcional): reconstrói qual era o ciclo atual "como se fosse
// hoje aquela data" -- necessário pra Evolução do Patrimônio, que recalcula
// um lote como ele estava no fim de um mês passado; sem isso, um lote que só
// viria a fechar/reabrir DEPOIS daquele mês faria o snapshot do mês passado
// usar o ciclo errado (o de hoje) e mostrar o lote zerado indevidamente.
function calcularInicioCicloLote(nomeLote, dataISOLimite) {
    let eventos = [];
    function dentroDoLimite(dataStr) {
        if (!dataISOLimite) return true;
        let iso = extrairDataISO(dataStr);
        return iso !== null && iso <= dataISOLimite;
    }
    relatorios.forEach(r => {
        if ((r.descricao || "Sem descrição") !== nomeLote) return;
        if (!dentroDoLimite(r.data)) return;
        let ordem = chaveOrdenacaoLote(r.data);
        if (!ordem) return;
        let qtd = calcularDadosCompletos(r).totalAnimais;
        eventos.push({ ordem, delta: (r.tipo || "venda") === "compra" ? qtd : -qtd });
    });
    transferenciasLotesCacheAdmin.forEach(t => {
        if (!dentroDoLimite(t.data)) return;
        let ordem = chaveOrdenacaoLote(t.data);
        if (!ordem) return;
        if (t.loteDestino === nomeLote) eventos.push({ ordem, delta: t.quantidade });
        if (t.loteOrigem === nomeLote) eventos.push({ ordem, delta: -t.quantidade });
    });

    if (eventos.length === 0) return null;
    eventos.sort((a, b) => a.ordem.localeCompare(b.ordem));

    let headcount = 0;
    let inicioCiclo = eventos[0].ordem;
    let aguardandoNovoCiclo = false;
    eventos.forEach(ev => {
        if (aguardandoNovoCiclo) { inicioCiclo = ev.ordem; aguardandoNovoCiclo = false; }
        headcount += ev.delta;
        if (headcount <= 0) aguardandoNovoCiclo = true;
    });
    return inicioCiclo;
}

async function mostrarCustoPorLote() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaCustoLote");
    if (!token || !corpo) return;

    await Promise.all([carregarEstoqueSaidasAdmin(), carregarCaixaLancamentosAdmin(), carregarTransferenciasLotesAdmin()]);

    // agrega compra/venda por nome de lote a partir das pesagens já sincronizadas
    // (a variável "relatorios" é global, vem de app.js) e soma as saídas de estoque
    // de cada lote — sem mexer nos registros originais de pesagem.
    let porLote = {};
    function grupoDoLote(nome) {
        if (!porLote[nome]) porLote[nome] = { comprados: 0, vendidos: 0, kgComprado: 0, kgVendido: 0, custoCompra: 0, custoInsumos: 0, receitaVenda: 0 };
        return porLote[nome];
    }

    // só conta o que aconteceu dentro do ciclo atual de cada lote (ver
    // calcularInicioCicloLote acima) -- assim um lote fechado e reaberto com
    // o mesmo nome começa "do zero" pra fins deste relatório.
    let cicloInicioPorLote = {};
    function dentroDoCicloAtual(nomeLote, dataStr) {
        if (!(nomeLote in cicloInicioPorLote)) cicloInicioPorLote[nomeLote] = calcularInicioCicloLote(nomeLote);
        let inicio = cicloInicioPorLote[nomeLote];
        if (!inicio) return true;
        let ordem = chaveOrdenacaoLote(dataStr);
        return ordem !== null && ordem >= inicio;
    }

    relatorios.forEach(r => {
        let nomeLote = r.descricao || "Sem descrição";
        if (!dentroDoCicloAtual(nomeLote, r.data)) return;
        let grupo = grupoDoLote(nomeLote);
        let d = calcularDadosCompletos(r);
        if ((r.tipo || "venda") === "compra") {
            grupo.comprados += d.totalAnimais;
            grupo.kgComprado += d.totalKg;
            grupo.custoCompra += d.totalRS;
        } else {
            grupo.vendidos += d.totalAnimais;
            grupo.kgVendido += d.totalKg;
            grupo.receitaVenda += d.totalRS;
        }
    });

    estoqueSaidasCacheAdmin.forEach(s => {
        if (!dentroDoCicloAtual(s.loteNome, s.data)) return;
        let grupo = grupoDoLote(s.loteNome);
        grupo.custoInsumos += s.valorTotal;
    });

    // lançamentos avulsos do Fluxo de Caixa marcados com um lote específico
    // (frete, cirurgia etc.) — despesa entra junto com o custo de insumos,
    // receita entra junto com a receita de vendas. Lançamentos sem lote
    // marcado (ex: salário do funcionário) não afetam nenhum lote.
    caixaLancamentosCacheAdmin.forEach(l => {
        if (!l.loteNome || !dentroDoCicloAtual(l.loteNome, l.data)) return;
        let grupo = grupoDoLote(l.loteNome);
        if (l.tipo === "saida") grupo.custoInsumos += l.valor;
        else grupo.receitaVenda += l.valor;
    });

    // transferência entre lotes: sai do lote origem como se fosse vendido
    // (headcount desconta E o custo que foi junto com os animais também sai
    // — sem isso o valor ficava contado nos dois lotes ao mesmo tempo), e
    // entra no destino como custo de aquisição, no valor exato que saiu —
    // não cria nem apaga patrimônio, só reorganiza entre os dois lotes.
    transferenciasLotesCacheAdmin.forEach(t => {
        if (dentroDoCicloAtual(t.loteOrigem, t.data)) {
            let origem = grupoDoLote(t.loteOrigem);
            origem.vendidos += t.quantidade;
            origem.kgVendido += Number(t.kgTotal) || 0;
            origem.custoCompra -= t.valorTotal;
        }
        if (dentroDoCicloAtual(t.loteDestino, t.data)) {
            let destino = grupoDoLote(t.loteDestino);
            destino.comprados += t.quantidade;
            destino.kgComprado += Number(t.kgTotal) || 0;
            destino.custoCompra += t.valorTotal;
        }
    });

    let nomesLotes = Object.keys(porLote).sort();
    if (nomesLotes.length === 0) {
        corpo.innerHTML = `<tr><td colspan="9">Nenhum dado de lote disponível ainda.</td></tr>`;
        return;
    }

    // Custo restante = o que ainda está "preso" no lote: tudo que foi gasto
    // (compra + insumo) menos o que já voltou em vendas — dividido pelos
    // animais que ainda sobraram. Não é o custo de compra de cada animal
    // (esse continua sendo o valor real pago por ele); é quanto do dinheiro
    // investido no lote como um todo ainda não foi recuperado, repartido
    // entre quem ainda não foi vendido. Pode ficar negativo se as vendas já
    // recuperaram mais do que o lote custou — nesse caso os que sobraram já
    // são "lucro puro", sem custo pendente.
    // headcount é passado à parte: um lote ENCERRADO (headcount 0) com custo
    // restante ainda positivo não tem mais como se recuperar — é prejuízo
    // realizado, não "ainda não vendido", e precisa aparecer em vermelho,
    // não com a mesma cor neutra de um lote que só ainda está em andamento.
    function formatarValorPossivelmenteNegativo(valor, headcount) {
        if (valor < 0) return { texto: "▲ R$ " + formatarMoeda(Math.abs(valor)) + " (lucro)", cor: "#0ca30c" };
        if (valor > 0 && headcount === 0) return { texto: "▼ R$ " + formatarMoeda(valor) + " (prejuízo)", cor: "#d03b3b" };
        // "inherit" em vez de uma cor fixa -- acompanha a cor de texto normal
        // da tela (clara no tema escuro, escura se algum dia voltar a ser
        // tema claro), em vez de travar num tom que só funciona num dos dois
        return { texto: "R$ " + formatarMoeda(valor), cor: "inherit" };
    }

    corpo.innerHTML = nomesLotes.map(nome => {
        let g = porLote[nome];
        // fórmula compartilhada com o celular (app.js) -- ver
        // calcularFormulaCustoLote(), garante que os dois nunca divergem
        let { headcount, kgAtual, custoRestante, custoMedio, custoPorKg } = calcularFormulaCustoLote(g);
        let restanteFmt = formatarValorPossivelmenteNegativo(custoRestante, headcount);
        let medioFmt = formatarValorPossivelmenteNegativo(custoMedio, headcount);
        let porKgFmt = formatarValorPossivelmenteNegativo(custoPorKg, headcount);
        return `
            <tr>
                <td>${nome}</td>
                <td>${headcount}</td>
                <td>R$ ${formatarMoeda(g.custoCompra)}</td>
                <td>R$ ${formatarMoeda(g.custoInsumos)}</td>
                <td>R$ ${formatarMoeda(g.receitaVenda)}</td>
                <td style="color:${restanteFmt.cor}">${restanteFmt.texto}</td>
                <td style="color:${headcount > 0 ? medioFmt.cor : 'inherit'}">${headcount > 0 ? medioFmt.texto : "—"}</td>
                <td style="color:${kgAtual > 0 ? porKgFmt.cor : 'inherit'}">${kgAtual > 0 ? porKgFmt.texto : "—"}</td>
                <td class="acoesUsuario acoesRelLote"><button class="btnRelLote btnVerRelLote" onclick='abrirRelatorioLote(${jsonAtributo(nome)})' title="Ver o relatório aqui na tela">${ICONES_REL_LOTE.verRelatorio}<span>Ver</span></button><button class="btnRelLote btnPdfRelLote" onclick='gerarRelatorioLotePDF(${jsonAtributo(nome)})' title="Baixar o relatório em PDF">${ICONES_REL_LOTE.baixarPdf}<span>PDF</span></button></td>
            </tr>
        `;
    }).join("");
}

// ========================================
// RELATÓRIO PDF DO LOTE
// ========================================
// Mesma lógica de mostrarCustoPorLote(), recalculada só pro lote escolhido,
// mais o detalhamento por categoria de insumo/despesa e a lista individual
// de cada animal comprado -- pro rancheiro decidir a hora de vender com o
// máximo de informação, não só o resumo da tabela.
// O cálculo fica separado: a mesma conta alimenta o PDF e a visualização na
// tela (abrirRelatorioLote), então os dois nunca mostram números diferentes.
function calcularRelatorioLote(nomeLote) {
    // mesmo corte de ciclo do mostrarCustoPorLote() -- se esse lote já foi
    // vendido por completo e reaberto com uma compra nova, o relatório mostra
    // só o ciclo atual, não a história inteira desde sempre.
    let inicioCiclo = calcularInicioCicloLote(nomeLote);
    function noCicloAtual(dataStr) {
        if (!inicioCiclo) return true;
        let ordem = chaveOrdenacaoLote(dataStr);
        return ordem !== null && ordem >= inicioCiclo;
    }

    let comprasDoLote = relatorios.filter(r => (r.descricao || "Sem descrição") === nomeLote && (r.tipo || "venda") === "compra" && noCicloAtual(r.data));
    let vendasDoLote = relatorios.filter(r => (r.descricao || "Sem descrição") === nomeLote && (r.tipo || "venda") === "venda" && noCicloAtual(r.data));

    let comprados = 0, vendidos = 0, kgComprado = 0, kgVendido = 0, custoCompra = 0, receitaVenda = 0;
    let animaisDetalhados = [];

    comprasDoLote.forEach(r => {
        let d = calcularDadosCompletos(r);
        comprados += d.totalAnimais;
        kgComprado += d.totalKg;
        custoCompra += d.totalRS;
        (r.pesos || []).forEach(p => {
            animaisDetalhados.push({
                peso: p.peso || 0,
                valor: d.valorDoItem(p.peso || 0),
                data: r.data ? r.data.split(",")[0] : "—",
                vendedor: r.vendedor || "Não informado",
                obs: p.obs || ""
            });
        });
    });
    vendasDoLote.forEach(r => {
        let d = calcularDadosCompletos(r);
        vendidos += d.totalAnimais;
        kgVendido += d.totalKg;
        receitaVenda += d.totalRS;
    });

    let entradasTransferenciaISO = [];
    let custoInsumos = 0;
    let insumosPorCategoria = {};
    function somarInsumo(chave, valor) {
        insumosPorCategoria[chave] = (insumosPorCategoria[chave] || 0) + valor;
    }
    estoqueSaidasCacheAdmin.filter(s => s.loteNome === nomeLote && noCicloAtual(s.data)).forEach(s => {
        custoInsumos += s.valorTotal;
        somarInsumo(s.produtoDescricao || "Outro insumo", s.valorTotal);
    });
    caixaLancamentosCacheAdmin.filter(l => l.loteNome === nomeLote && noCicloAtual(l.data)).forEach(l => {
        if (l.tipo === "saida") {
            custoInsumos += l.valor;
            somarInsumo(l.categoria || "Despesa avulsa", l.valor);
        } else {
            receitaVenda += l.valor;
        }
    });
    transferenciasLotesCacheAdmin.filter(t => t.loteDestino === nomeLote && noCicloAtual(t.data)).forEach(t => {
        comprados += t.quantidade;
        kgComprado += Number(t.kgTotal) || 0;
        custoCompra += t.valorTotal;
        somarInsumo("Recebido por transferência", t.valorTotal);
        entradasTransferenciaISO.push(extrairDataISO(t.data));
        // transferência lançada no computador não tem pesos: o animal entra
        // na lista do mesmo jeito (antes sumia), só que "sem peso"
        let pesosTransf = t.pesos || [];
        let valorPorAnimal = t.quantidade > 0 ? (Number(t.valorTotal) || 0) / t.quantidade : 0;
        for (let i = 0; i < Math.max(t.quantidade, pesosTransf.length); i++) {
            let p = pesosTransf[i];
            animaisDetalhados.push({
                peso: p ? (p.peso || 0) : null,
                valor: valorPorAnimal,
                data: t.data ? String(t.data).split(",")[0] : "—",
                vendedor: "Transferido de " + t.loteOrigem,
                obs: p ? (p.obs || "") : "transferido sem pesagem"
            });
        }
    });
    transferenciasLotesCacheAdmin.filter(t => t.loteOrigem === nomeLote && noCicloAtual(t.data)).forEach(t => {
        vendidos += t.quantidade;
        kgVendido += Number(t.kgTotal) || 0;
        custoCompra -= t.valorTotal;
    });

    let headcount = comprados - vendidos;
    let kgAtual = kgComprado - kgVendido;
    let gastoTotal = custoCompra + custoInsumos;
    let custoRestante = gastoTotal - receitaVenda;
    let custoMedioAnimalRestante = headcount > 0 ? custoRestante / headcount : 0;
    let custoPorKg = kgAtual > 0 ? custoRestante / kgAtual : 0;
    let comPeso = animaisDetalhados.filter(a => a.peso !== null);
    let animaisSemPeso = animaisDetalhados.length - comPeso.length;
    let pesoMedioCompra = comPeso.length > 0 ? comPeso.reduce((t, a) => t + a.peso, 0) / comPeso.length : 0;
    let custoMedioCompraAnimal = comprados > 0 ? custoCompra / comprados : 0;

    let datasCompra = comprasDoLote.map(r => extrairDataISO(r.data)).concat(entradasTransferenciaISO).filter(Boolean).sort();
    let primeiraCompraISO = datasCompra[0] || null;
    let diasEmPosse = primeiraCompraISO ? Math.max(0, Math.floor((new Date() - new Date(primeiraCompraISO + "T00:00:00")) / 86400000)) : null;

    return { animaisSemPeso, nomeLote, headcount, comprados, vendidos, kgComprado, kgVendido, kgAtual, custoCompra, custoInsumos, gastoTotal, receitaVenda, custoRestante, custoMedioAnimalRestante, custoPorKg, pesoMedioCompra, custoMedioCompraAnimal, primeiraCompraISO, diasEmPosse, insumosPorCategoria, animaisDetalhados };
}

function gerarRelatorioLotePDF(nomeLote) {
    let { animaisSemPeso, headcount, comprados, vendidos, kgComprado, kgVendido, kgAtual, custoCompra, custoInsumos, gastoTotal, receitaVenda, custoRestante, custoMedioAnimalRestante, custoPorKg, pesoMedioCompra, custoMedioCompraAnimal, primeiraCompraISO, diasEmPosse, insumosPorCategoria, animaisDetalhados } = calcularRelatorioLote(nomeLote);

    const { jsPDF } = window.jspdf;
    let pdf = new jsPDF();
    let y = 20;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("RELATÓRIO DE LOTE", 105, y, { align: "center" });
    y += 7;
    pdf.setFontSize(13);
    pdf.text(nomeLote, 105, y, { align: "center" });
    y += 4;
    pdf.line(10, y, 200, y);
    y += 8;

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, y);
    y += 10;

    function linhaResumo(label, valor) {
        pdf.setFont("helvetica", "normal");
        pdf.text(label, 10, y);
        pdf.setFont("helvetica", "bold");
        pdf.text(valor, 130, y);
        y += 6.5;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("RESUMO GERAL", 10, y);
    y += 7;
    pdf.setFontSize(10);
    linhaResumo("Animais atuais:", String(headcount));
    linhaResumo("Total comprado neste ciclo:", String(comprados));
    linhaResumo("Total vendido neste ciclo:", String(vendidos));
    linhaResumo("Peso total comprado:", formatarPeso(kgComprado) + " kg");
    linhaResumo("Peso médio por animal (entrada):", pesoMedioCompra.toFixed(2).replace(".", ",") + " kg" + (animaisSemPeso ? ` (${animaisSemPeso} sem peso)` : ""));
    linhaResumo("1ª entrada deste ciclo:", primeiraCompraISO ? primeiraCompraISO.split("-").reverse().join("/") : "—");
    linhaResumo("Dias em posse (desde a 1ª compra):", diasEmPosse !== null ? diasEmPosse + " dias" : "—");
    y += 3;

    pdf.setFont("helvetica", "bold");
    pdf.text("INVESTIMENTO", 10, y);
    y += 7;
    pdf.setFontSize(10);
    linhaResumo("Sub-total investido em compra:", "R$ " + formatarMoeda(custoCompra));
    linhaResumo("Custo médio de compra por animal:", "R$ " + formatarMoeda(custoMedioCompraAnimal));
    linhaResumo("Sub-total investido em insumos/despesas:", "R$ " + formatarMoeda(custoInsumos));
    linhaResumo("Investimento total (compra + insumos):", "R$ " + formatarMoeda(gastoTotal));
    linhaResumo("Receita de vendas até agora:", "R$ " + formatarMoeda(receitaVenda));
    y += 3;

    pdf.setFont("helvetica", "bold");
    pdf.text("SITUAÇÃO ATUAL (pra decisão de venda)", 10, y);
    y += 7;
    pdf.setFontSize(10);
    let restanteTexto = custoRestante < 0
        ? `R$ ${formatarMoeda(Math.abs(custoRestante))} (lucro já garantido)`
        : `R$ ${formatarMoeda(custoRestante)}`;
    linhaResumo("Custo restante (ainda não recuperado):", restanteTexto);
    linhaResumo("Custo médio por animal restante:", headcount > 0 ? "R$ " + formatarMoeda(custoMedioAnimalRestante) : "—");
    linhaResumo("Custo por Kg (ponto de equilíbrio):", kgAtual > 0 ? "R$ " + formatarMoeda(custoPorKg) + "/kg" : "—");
    y += 8;

    let categorias = Object.keys(insumosPorCategoria).sort();
    if (categorias.length > 0) {
        if (y > 250) { pdf.addPage(); y = 20; }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text("DETALHAMENTO DE INSUMOS E DESPESAS", 10, y);
        y += 8;
        pdf.line(10, y - 5, 200, y - 5);
        pdf.setFontSize(10);
        categorias.forEach(cat => {
            if (y > 275) { pdf.addPage(); y = 20; }
            pdf.setFont("helvetica", "normal");
            pdf.text(cat, 10, y);
            pdf.setFont("helvetica", "bold");
            pdf.text("R$ " + formatarMoeda(insumosPorCategoria[cat]), 130, y);
            y += 6.5;
        });
        y += 6;
    }

    if (y > 250) { pdf.addPage(); y = 20; }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(`ANIMAIS QUE ENTRARAM NESTE LOTE (${animaisDetalhados.length})`, 10, y);
    y += 8;
    pdf.line(10, y - 5, 200, y - 5);
    pdf.setFontSize(9);
    pdf.text("Nº", 10, y);
    pdf.text("Peso (kg)", 30, y);
    pdf.text("Valor", 65, y);
    pdf.text("Data", 100, y);
    pdf.text("Vendedor", 130, y);
    pdf.text("Obs.", 175, y);
    y += 2;
    pdf.line(10, y, 200, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    animaisDetalhados.forEach((a, i) => {
        if (y > 280) { pdf.addPage(); y = 20; }
        pdf.text(String(i + 1), 10, y);
        pdf.text(a.peso === null ? "sem peso" : formatarPeso(a.peso), 30, y);
        pdf.text("R$ " + formatarMoeda(a.valor), 65, y);
        pdf.text(a.data, 100, y);
        pdf.text(a.vendedor.slice(0, 20), 130, y);
        pdf.text((a.obs || "-").slice(0, 15), 175, y);
        y += 6;
    });

    pdf.save(`Relatorio_Lote_${nomeLote.replace(/\s+/g, "_")}.pdf`);
}

// ---------- relatório do lote NA TELA (sem baixar arquivo) ----------
let relatorioLoteAberto = null;

// ícones próprios (traço fino, mesmo desenho do menu lateral) -- no lugar
// de emojis, que mudam de cara em cada aparelho e não parecem de sistema
const ICONES_REL_LOTE = {
    "verRelatorio": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M13 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21H11\"></path><path d=\"M13 3l5 5v2.5\"></path><path d=\"M13 3v5h5\"></path><path d=\"M8 12h4M8 15.5h2\"></path><circle cx=\"16.5\" cy=\"16.5\" r=\"3\"></circle><path d=\"M18.7 18.7L21 21\"></path></svg>",
    "baixarPdf": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z\"></path><path d=\"M14 3v5h5\"></path><path d=\"M12 11v6\"></path><path d=\"M9.5 14.5L12 17l2.5-2.5\"></path></svg>",
    "relatorio": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z\"></path><path d=\"M14 3v5h5\"></path><path d=\"M9 17v-3M12 17v-5M15 17v-2\"></path></svg>",
    "boi": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M4 4c0 3 1.5 4.5 4 4.5h8c2.5 0 4-1.5 4-4.5\"></path><path d=\"M7 8.5v5a5 5 0 0 0 10 0v-5\"></path><path d=\"M9.5 17.5h5\"></path><circle cx=\"10\" cy=\"12\" r=\".7\" fill=\"currentColor\"></circle><circle cx=\"14\" cy=\"12\" r=\".7\" fill=\"currentColor\"></circle></svg>",
    "investimento": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><ellipse cx=\"9\" cy=\"6\" rx=\"6\" ry=\"2.5\"></ellipse><path d=\"M3 6v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6\"></path><path d=\"M3 10v4c0 1.4 2.7 2.5 6 2.5\"></path><path d=\"M3 14v4c0 1.4 2.7 2.5 6 2.5\"></path><circle cx=\"16.5\" cy=\"16.5\" r=\"4.5\"></circle><path d=\"M16.5 14.5v4M15 16.5h3\"></path></svg>",
    "receita": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 17l6-6 4 4 8-8\"></path><path d=\"M15 7h6v6\"></path></svg>",
    "ampulheta": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 3h12M6 21h12\"></path><path d=\"M7 3v3a5 5 0 0 0 5 5 5 5 0 0 0 5-5V3\"></path><path d=\"M7 21v-3a5 5 0 0 1 5-5 5 5 0 0 1 5 5v3\"></path></svg>",
    "lucro": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z\"></path><path d=\"M8.5 12l2.5 2.5 4.5-5\"></path></svg>"
};

function abrirRelatorioLote(nomeLote) {
    let r = calcularRelatorioLote(nomeLote);
    relatorioLoteAberto = nomeLote;
    let esc = escaparHtmlPesagem;
    let rs = v => "R$ " + formatarMoeda(v);
    let lucro = r.custoRestante < 0;

    document.getElementById("relLoteNome").innerText = nomeLote;
    document.getElementById("relLoteGerado").innerText = "Gerado em " + new Date().toLocaleString("pt-BR");

    let kpi = (icone, rotulo, valor, sub, classe) => `
        <div class="relLoteKpi ${classe || ""}">
            <span class="relLoteKpiRotulo"><span class="relLoteKpiIcone">${ICONES_REL_LOTE[icone]}</span>${rotulo}</span>
            <span class="relLoteKpiValor">${valor}</span>
            ${sub ? `<span class="relLoteKpiSub">${sub}</span>` : ""}
        </div>`;
    let linha = (rotulo, valor, destaque) => `<div class="relLoteLinha${destaque ? " relLoteLinhaDestaque" : ""}"><span>${rotulo}</span><b>${valor}</b></div>`;

    let categorias = Object.keys(r.insumosPorCategoria).sort((a, b) => r.insumosPorCategoria[b] - r.insumosPorCategoria[a]);
    let maiorCategoria = categorias.length ? r.insumosPorCategoria[categorias[0]] : 0;
    let totalCategorias = categorias.reduce((t, c) => t + r.insumosPorCategoria[c], 0);

    let pesoTotalAnimais = r.animaisDetalhados.reduce((t, a) => t + (a.peso || 0), 0);
    let valorTotalAnimais = r.animaisDetalhados.reduce((t, a) => t + a.valor, 0);

    document.getElementById("relLoteCorpo").innerHTML = `
        <div class="relLoteKpis">
            ${kpi("boi", "Animais atuais", r.headcount, `${r.comprados} comprados · ${r.vendidos} vendidos`, "relLoteKpiAnimais")}
            ${kpi("investimento", "Investimento total", rs(r.gastoTotal), "compra + insumos/despesas", "relLoteKpiInvest")}
            ${kpi("receita", "Receita de vendas", rs(r.receitaVenda), "até agora", "relLoteKpiReceita")}
            ${kpi(lucro ? "lucro" : "ampulheta", lucro ? "Lucro já garantido" : "Custo restante", rs(Math.abs(r.custoRestante)),
                lucro ? "as vendas já pagaram o lote" : "ainda não voltou em vendas", lucro ? "relLoteKpiLucro" : "relLoteKpiRestante")}
        </div>

        <div class="relLoteGrade">
            <section class="relLoteSecao">
                <h4>Resumo geral</h4>
                ${linha("Animais atuais", r.headcount)}
                ${linha("Total comprado neste ciclo", r.comprados)}
                ${linha("Total vendido neste ciclo", r.vendidos)}
                ${linha("Peso total comprado", formatarPeso(r.kgComprado) + " kg")}
                ${linha("Peso médio por animal (entrada)", r.pesoMedioCompra.toFixed(2).replace(".", ",") + " kg")}
                ${linha("1ª entrada deste ciclo", r.primeiraCompraISO ? r.primeiraCompraISO.split("-").reverse().join("/") : "—")}
                ${linha("Dias em posse", r.diasEmPosse !== null ? r.diasEmPosse + " dias" : "—")}
            </section>
            <section class="relLoteSecao">
                <h4>Investimento</h4>
                ${linha("Investido em compra", rs(r.custoCompra))}
                ${linha("Custo médio de compra por animal", rs(r.custoMedioCompraAnimal))}
                ${linha("Investido em insumos/despesas", rs(r.custoInsumos))}
                ${linha("Investimento total", rs(r.gastoTotal))}
                ${linha("Receita de vendas até agora", rs(r.receitaVenda))}
            </section>
            <section class="relLoteSecao relLoteSecaoDecisao">
                <h4>Situação atual <small>pra decisão de venda</small></h4>
                ${linha("Custo restante (não recuperado)", lucro ? rs(Math.abs(r.custoRestante)) + " (lucro já garantido)" : rs(r.custoRestante), true)}
                ${linha("Custo médio por animal restante", r.headcount > 0 ? rs(r.custoMedioAnimalRestante) : "—", true)}
                ${linha("Custo por kg (ponto de equilíbrio)", r.kgAtual > 0 ? rs(r.custoPorKg) + "/kg" : "—", true)}
                ${r.animaisSemPeso > 0 ? `<p class="relLoteAviso">${r.animaisSemPeso === 1 ? "1 animal entrou" : r.animaisSemPeso + " animais entraram"} sem peso (transferência lançada no computador). O peso médio considera só os pesados, e o custo por kg divide o custo de todos pelo peso só dos pesados — fica mais alto do que o real.</p>` : ""}
            </section>
            <section class="relLoteSecao">
                <h4>Insumos e despesas</h4>
                ${categorias.length === 0 ? `<p class="relLoteVazio">Nenhum insumo ou despesa lançado neste lote.</p>` :
                    categorias.map(c => `
                        <div class="relLoteCategoria">
                            <div class="relLoteLinha"><span>${esc(c)}</span><b>${rs(r.insumosPorCategoria[c])}</b></div>
                            <div class="relLoteBarra"><i style="width:${maiorCategoria > 0 ? Math.max(2, r.insumosPorCategoria[c] / maiorCategoria * 100) : 0}%"></i></div>
                        </div>`).join("") + linha("Total", rs(totalCategorias))}
            </section>
        </div>

        <section class="relLoteSecao relLoteAnimais">
            <h4>Animais que entraram neste lote <small>(${r.animaisDetalhados.length}${r.animaisSemPeso ? ` · ${r.animaisSemPeso} sem peso` : ""})</small></h4>
            ${r.animaisDetalhados.length === 0 ? `<p class="relLoteVazio">Nenhum animal comprado neste ciclo.</p>` : `
            <div class="relLoteTabelaRolagem">
                <table class="relLoteTabela">
                    <thead><tr><th>Nº</th><th>Peso (kg)</th><th>Valor</th><th>Data</th><th>Vendedor</th><th>Obs.</th></tr></thead>
                    <tbody>${r.animaisDetalhados.map((a, i) => `
                        <tr><td>${i + 1}</td><td>${a.peso === null ? `<span class="relLoteSemPeso">sem peso</span>` : formatarPeso(a.peso)}</td><td>${rs(a.valor)}</td><td>${esc(a.data)}</td><td>${esc(a.vendedor)}</td><td>${esc(a.obs || "—")}</td></tr>`).join("")}
                    </tbody>
                    <tfoot><tr><td>Total</td><td>${formatarPeso(pesoTotalAnimais)}</td><td>${rs(valorTotalAnimais)}</td><td colspan="3"></td></tr></tfoot>
                </table>
            </div>`}
        </section>`;

    let modal = document.getElementById("modalRelatorioLote");
    modal.style.display = "flex";
    document.getElementById("relLoteCorpo").scrollTop = 0;
}

function fecharRelatorioLote() {
    let modal = document.getElementById("modalRelatorioLote");
    if (modal) modal.style.display = "none";
    relatorioLoteAberto = null;
}

function baixarPdfRelatorioLoteAberto() {
    if (relatorioLoteAberto) gerarRelatorioLotePDF(relatorioLoteAberto);
}

document.addEventListener("keydown", e => {
    if (e.key === "Escape" && relatorioLoteAberto) fecharRelatorioLote();
});

// ========================================
// SALDO INICIAL DE CAIXA
// ========================================
// O dinheiro que o rancho já tinha antes de começar a usar o sistema.
// Sem isso, todo cálculo de caixa (Fluxo de Caixa, Patrimônio Total)
// começaria do zero, ignorando o capital que já existia.
let saldoInicialCache = { valor: 0, data: null };

async function carregarSaldoInicial() {
    let token = obterToken();
    if (!token) return saldoInicialCache;
    try {
        let resp = await fetch(`${API_URL}/api/saldo-inicial`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return saldoInicialCache;
        saldoInicialCache = await resp.json();
        return saldoInicialCache;
    } catch (e) {
        return saldoInicialCache;
    }
}

function atualizarInfoSaldoInicial() {
    let el = document.getElementById("saldoInicialInfo");
    if (!el) return;
    el.innerText = saldoInicialCache.valor
        ? `Saldo inicial: R$ ${formatarMoeda(saldoInicialCache.valor)} (a partir de ${extrairDataISO(saldoInicialCache.data) ? saldoInicialCache.data.split(",")[0] : "—"})`
        : "Nenhum saldo inicial definido ainda.";
}

function abrirModalSaldoInicial() {
    document.getElementById("saldoInicialValorInput").value = saldoInicialCache.valor ? String(saldoInicialCache.valor).replace(".", ",") : "";
    let dataISO = extrairDataISO(saldoInicialCache.data) || new Date().toISOString().slice(0, 10);
    document.getElementById("saldoInicialDataInput").value = dataISO;
    let erroEl = document.getElementById("saldoInicialErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalSaldoInicial").style.display = "flex";
}

function fecharModalSaldoInicial() {
    document.getElementById("modalSaldoInicial").style.display = "none";
}

async function salvarSaldoInicial() {
    let erroEl = document.getElementById("saldoInicialErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let valor = parseFloat(document.getElementById("saldoInicialValorInput").value.replace(",", "."));
        let dataISOSimples = document.getElementById("saldoInicialDataInput").value;
        if (!Number.isFinite(valor) || valor < 0) { mostrarErro("Informe um valor válido."); return; }

        let dataFinal = formatarDataBR(dataISOSimples);
        let resp = await fetch(`${API_URL}/api/saldo-inicial`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ valor, data: dataFinal })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar (HTTP ${resp.status}).`); return; }

        saldoInicialCache = dados;
        fecharModalSaldoInicial();
        atualizarInfoSaldoInicial();

        if (typeof mostrarPatrimonio === "function") mostrarPatrimonio();
        if (typeof mostrarEvolucaoPatrimonio === "function") mostrarEvolucaoPatrimonio();
        if (typeof mostrarResultadoMensal === "function") mostrarResultadoMensal();
        let telaFluxo = document.getElementById("telaFluxoCaixa");
        if (telaFluxo && telaFluxo.classList.contains("ativa") && typeof mostrarFluxoCaixa === "function") mostrarFluxoCaixa();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

// ========================================
// PATRIMÔNIO TOTAL E RESULTADO MENSAL
// ========================================
// Custo médio por animal de um lote: (tudo que já foi gasto comprando +
// aplicando insumos nele) dividido pela quantidade TOTAL de animais já
// comprados pra esse lote (não a quantidade atual). Diferente do "Custo
// Restante" da tabela de Custo por Lote — ali o valor já vem líquido de
// vendas (pra saber quanto falta recuperar); aqui o valor fica fixo no
// custo de aquisição, pra reconhecer o lucro de cada venda no mês em que
// ela aconteceu, e pra avaliar o rebanho que ainda está vivo pelo que ele
// custou de verdade.
// Carrega todas as caches usadas pelos cálculos financeiros do Dashboard
// de uma vez só. As funções de agregação abaixo são só leitura sobre essas
// caches (sem fetch próprio) justamente pra poderem ser chamadas várias
// vezes em sequência (uma por mês, na Evolução do Patrimônio) sem
// martelar a API com pedidos repetidos dos mesmos dados.
async function carregarCachesFinanceirasDashboard() {
    await Promise.all([
        carregarEstoqueSaidasAdmin(),
        carregarCaixaLancamentosAdmin(),
        carregarEstoqueEntradasAdmin(),
        carregarProdutosAdmin(),
        carregarSaldoInicial(),
        carregarTransferenciasLotesAdmin(),
        carregarBensAdmin()
    ]);
    atualizarInfoSaldoInicial();
}

// dataISOLimite (opcional, "yyyy-mm-dd"): quando informado, só considera
// lançamentos com data até ali — usado pra reconstruir o patrimônio "como
// era no fim de tal mês" na Evolução do Patrimônio. Sem esse parâmetro,
// considera o histórico inteiro (comportamento original). Assume que
// carregarCachesFinanceirasDashboard() já rodou antes.
function agregarCustoLotesFinanceiro(dataISOLimite) {
    function dentroDoPeriodo(dataStr) {
        if (!dataISOLimite) return true;
        let iso = extrairDataISO(dataStr);
        return iso !== null && iso <= dataISOLimite;
    }

    // mesmo corte de ciclo do Custo por Lote (calcularInicioCicloLote) --
    // sem isso, um lote fechado (vendido até 0) e reaberto com o mesmo nome
    // arrastava pra sempre o resultado do ciclo antigo pro Resultado
    // Mensal/Patrimônio, mesmo já respeitando dataISOLimite. O corte em si
    // também é calculado "como era" até dataISOLimite (não com o ciclo de
    // HOJE), senão um lote que só fecha/reabre depois do mês sendo
    // reconstruído pela Evolução do Patrimônio zerava indevidamente.
    let cicloInicioPorLote = {};
    function dentroDoCicloAtual(nomeLote, dataStr) {
        if (!(nomeLote in cicloInicioPorLote)) cicloInicioPorLote[nomeLote] = calcularInicioCicloLote(nomeLote, dataISOLimite);
        let inicio = cicloInicioPorLote[nomeLote];
        if (!inicio) return true;
        let ordem = chaveOrdenacaoLote(dataStr);
        return ordem !== null && ordem >= inicio;
    }
    function dentro(nomeLote, dataStr) {
        return dentroDoPeriodo(dataStr) && dentroDoCicloAtual(nomeLote, dataStr);
    }

    let porLote = {};
    function grupoDoLote(nome) {
        if (!porLote[nome]) porLote[nome] = { comprados: 0, vendidos: 0, custoCompra: 0, custoInsumos: 0 };
        return porLote[nome];
    }

    relatorios.forEach(r => {
        let nomeLote = r.descricao || "Sem descrição";
        if (!dentro(nomeLote, r.data)) return;
        let grupo = grupoDoLote(nomeLote);
        let d = calcularDadosCompletos(r);
        if ((r.tipo || "venda") === "compra") {
            grupo.comprados += d.totalAnimais;
            grupo.custoCompra += d.totalRS;
        } else {
            grupo.vendidos += d.totalAnimais;
        }
    });

    estoqueSaidasCacheAdmin.forEach(s => {
        if (!dentro(s.loteNome, s.data)) return;
        grupoDoLote(s.loteNome).custoInsumos += s.valorTotal;
    });

    caixaLancamentosCacheAdmin.forEach(l => {
        if (!l.loteNome || !dentro(l.loteNome, l.data)) return;
        let grupo = grupoDoLote(l.loteNome);
        // mesmo tratamento do Custo por Lote: despesa avulsa do lote soma no
        // custo, receita avulsa do lote (ex: venda de esterco) abate — sem
        // isso ela aparecia só no Custo por Lote e "sumia" do Resultado
        // Mensal/Patrimônio, dando números diferentes em cada relatório.
        if (l.tipo === "saida") grupo.custoInsumos += l.valor;
        else grupo.custoInsumos -= l.valor;
    });

    // transferência entre lotes: tira do lote origem tanto os animais quanto
    // o custo que foi junto com eles, e leva os dois pro destino — soma
    // total sempre igual, não é compra nem venda. Diferente do Custo por
    // Lote (que divide por headcount = comprados-vendidos, então tanto faz
    // subtrair de comprados ou somar em vendidos), aqui custoMedioAnimal
    // divide direto por "comprados" — por isso a saída tem que reduzir
    // "comprados" mesmo (nunca foi uma venda), senão a média por animal dos
    // que ficaram sai diluída errado.
    transferenciasLotesCacheAdmin.forEach(t => {
        if (dentro(t.loteOrigem, t.data)) {
            let origem = grupoDoLote(t.loteOrigem);
            origem.comprados -= t.quantidade;
            origem.custoCompra -= t.valorTotal;
        }
        if (dentro(t.loteDestino, t.data)) {
            let destino = grupoDoLote(t.loteDestino);
            destino.comprados += t.quantidade;
            destino.custoCompra += t.valorTotal;
        }
    });

    Object.values(porLote).forEach(g => {
        g.custoMedioAnimal = g.comprados > 0 ? (g.custoCompra + g.custoInsumos) / g.comprados : 0;
        g.headcountAtual = g.comprados - g.vendidos;
    });

    return porLote;
}

// Mesma ideia do parâmetro acima: sem dataISOLimite soma o histórico
// inteiro (saldo de caixa "desde sempre"); com ele, só até aquela data.
function calcularCaixaAcumulado(dataISOLimite) {
    function dentroDoPeriodo(dataStr) {
        if (!dataISOLimite) return true;
        let iso = extrairDataISO(dataStr);
        return iso !== null && iso <= dataISOLimite;
    }

    let entradasCaixa = 0, saidasCaixa = 0;
    if (saldoInicialCache.valor && dentroDoPeriodo(saldoInicialCache.data)) {
        entradasCaixa += saldoInicialCache.valor;
    }
    relatorios.forEach(r => {
        if (!dentroDoPeriodo(r.data)) return;
        let d = calcularDadosCompletos(r);
        if ((r.tipo || "venda") === "compra") saidasCaixa += d.totalRS;
        else entradasCaixa += d.totalRS;
    });
    // Entrada de estoque NÃO conta como saída de caixa aqui de propósito: ela
    // só registra que o produto chegou fisicamente, não que o dinheiro saiu
    // (a compra pode ter sido parcelada via Contas a Pagar, por exemplo). O
    // impacto real no caixa só acontece quando existe um lançamento de
    // verdade — manual ou de uma parcela paga — senão a mesma compra conta
    // duas vezes: uma na entrada, outra a cada parcela. O custo do estoque
    // já entra no Patrimônio pelo componente separado "estoque parado no
    // almoxarifado" (valorEstoqueAlmoxarifado em mostrarPatrimonio()).
    caixaLancamentosCacheAdmin.forEach(l => {
        if (!dentroDoPeriodo(l.data)) return;
        if (l.tipo === "saida") saidasCaixa += l.valor;
        else entradasCaixa += l.valor;
    });

    return entradasCaixa - saidasCaixa;
}

function valorRebanhoVivo(porLote) {
    // nunca negativo — um lote já totalmente vendido não "deve" patrimônio
    // pra trás, o excesso já virou lucro realizado (está embutido no caixa).
    return Object.values(porLote).reduce((soma, g) => soma + Math.max(g.custoMedioAnimal * g.headcountAtual, 0), 0);
}

async function mostrarPatrimonio() {
    let elTotal = document.getElementById("patrimonioTotal");
    if (!elTotal) return;

    await carregarCachesFinanceirasDashboard();

    let caixaAcumulado = calcularCaixaAcumulado();
    let porLote = agregarCustoLotesFinanceiro();
    let valorRebanho = valorRebanhoVivo(porLote);

    // insumos comprados mas ainda não aplicados a nenhum lote — parados no
    // almoxarifado, valendo pelo custo médio de compra.
    let valorEstoqueAlmoxarifado = produtosCacheAdmin.reduce((soma, p) => {
        return soma + (p.saldoAtual || 0) * (p.custoMedioUnitario || 0);
    }, 0);

    // bens da fazenda em uso (veículos, máquinas, terra...) pelo valor atual
    let valorBens = valorBensNaData();

    let patrimonioTotal = caixaAcumulado + valorRebanho + valorEstoqueAlmoxarifado + valorBens;

    let elBens = document.getElementById("patrimonioBens");
    if (elBens) elBens.innerText = "R$ " + formatarMoeda(valorBens);
    document.getElementById("patrimonioCaixa").innerText = "R$ " + formatarMoeda(caixaAcumulado);
    document.getElementById("patrimonioRebanho").innerText = "R$ " + formatarMoeda(valorRebanho);
    document.getElementById("patrimonioEstoque").innerText = "R$ " + formatarMoeda(valorEstoqueAlmoxarifado);
    elTotal.innerText = "R$ " + formatarMoeda(patrimonioTotal);

    atualizarDonutPatrimonio(caixaAcumulado, valorRebanho, valorEstoqueAlmoxarifado, patrimonioTotal, valorBens);
}

// Desenha o gráfico de rosca "Composição do Patrimônio" a partir dos mesmos
// 3 valores que já aparecem nas submétricas acima -- cada fatia é o mesmo
// círculo com um traço parcial (stroke-dasharray/-dashoffset), técnica
// padrão de donut em SVG sem precisar de nenhuma biblioteca de gráfico.
function atualizarDonutPatrimonio(caixa, rebanho, estoque, total, bens) {
    bens = bens || 0;
    let elRebanho = document.getElementById("donutFatiaRebanho");
    if (!elRebanho) return; // defensivo -- só existe na tela do Dashboard

    let raio = 50;
    let circunferencia = 2 * Math.PI * raio;
    let gap = 3; // espaço visual entre fatias, em unidades do perímetro
    let totalPositivo = Math.max(total, 0.01); // evita dividir por zero

    let fatias = [
        { chave: "rebanho", valor: rebanho, el: elRebanho },
        { chave: "caixa", valor: caixa, el: document.getElementById("donutFatiaCaixa") },
        { chave: "estoque", valor: estoque, el: document.getElementById("donutFatiaEstoque") },
        { chave: "bens", valor: bens, el: document.getElementById("donutFatiaBens") }
    ].filter(f => f.el);

    let acumulado = 0;
    fatias.forEach(f => {
        let valorPositivo = Math.max(f.valor, 0);
        let fracao = valorPositivo / totalPositivo;
        let comprimento = Math.max(fracao * circunferencia - gap, 0);
        f.el.setAttribute("stroke-dasharray", `${comprimento} ${circunferencia - comprimento}`);
        f.el.setAttribute("stroke-dashoffset", String(-acumulado));
        acumulado += fracao * circunferencia;
    });

    function pct(v) {
        return totalPositivo > 0 ? Math.round((Math.max(v, 0) / totalPositivo) * 100) : 0;
    }
    let legRebanho = document.getElementById("donutLegendaRebanho");
    let legCaixa = document.getElementById("donutLegendaCaixa");
    let legEstoque = document.getElementById("donutLegendaEstoque");
    if (legRebanho) legRebanho.innerText = `R$ ${formatarMoeda(rebanho)} (${pct(rebanho)}%)`;
    if (legCaixa) legCaixa.innerText = `R$ ${formatarMoeda(caixa)} (${pct(caixa)}%)`;
    if (legEstoque) legEstoque.innerText = `R$ ${formatarMoeda(estoque)} (${pct(estoque)}%)`;
    let legBens = document.getElementById("donutLegendaBens");
    if (legBens) legBens.innerText = `R$ ${formatarMoeda(bens)} (${pct(bens)}%)`;
}

const NOMES_MESES_RESULTADO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function chaveMes(ano, mes) {
    // mês com 2 dígitos ("07", "10") pra ordenar como string sem o "2026-10"
    // (Novembro) ficar antes do "2026-2" (Março) na ordenação alfabética.
    return ano + "-" + String(mes).padStart(2, "0");
}

async function mostrarResultadoMensal() {
    let corpo = document.getElementById("corpoTabelaResultadoMensal");
    if (!corpo) return;

    await carregarCachesFinanceirasDashboard();
    // custo por lote precisa ser o que se sabia NA DATA de cada venda, não o
    // custo de hoje -- senão uma compra nova feita meses depois muda
    // silenciosamente o resultado de um mês já fechado toda vez que a tela é
    // reaberta. Memoiza por data pra não recalcular o mesmo dia repetido.
    let custoLotesPorData = {};
    function custoLotesAteData(dataISO) {
        if (!(dataISO in custoLotesPorData)) custoLotesPorData[dataISO] = agregarCustoLotesFinanceiro(dataISO);
        return custoLotesPorData[dataISO];
    }

    let porMes = {};
    function grupoDoMes(ano, mes) {
        let chave = chaveMes(ano, mes);
        if (!porMes[chave]) porMes[chave] = { ano, mes, receitaVendas: 0, custoGadoVendido: 0, despesasGerais: 0 };
        return porMes[chave];
    }

    // garante que TODO mês com algum movimento apareça na tabela -- mesmo
    // um mês só de compra (sem venda nenhuma ainda), que do contrário
    // "sumia" da lista e parecia dado faltando. O resultado desse mês fica
    // zero mesmo (não é prejuízo nem lucro, só não vendeu nada ainda) --
    // ver formatarResultado() abaixo pra como isso é mostrado.
    function marcarMesComAtividade(dataStr) {
        let dm = extrairMesAnoDaData(dataStr);
        if (dm) grupoDoMes(dm.ano, dm.mes);
    }
    relatorios.forEach(r => marcarMesComAtividade(r.data));
    caixaLancamentosCacheAdmin.forEach(l => marcarMesComAtividade(l.data));
    estoqueSaidasCacheAdmin.forEach(s => marcarMesComAtividade(s.data));
    transferenciasLotesCacheAdmin.forEach(t => marcarMesComAtividade(t.data));

    relatorios.forEach(r => {
        if ((r.tipo || "venda") !== "venda") return;
        let dm = extrairMesAnoDaData(r.data);
        if (!dm) return;
        let d = calcularDadosCompletos(r);
        let nomeLote = r.descricao || "Sem descrição";
        let dataISO = extrairDataISO(r.data);
        let porLoteNaData = dataISO ? custoLotesAteData(dataISO) : {};
        let custoMedio = porLoteNaData[nomeLote] ? porLoteNaData[nomeLote].custoMedioAnimal : 0;
        let grupo = grupoDoMes(dm.ano, dm.mes);
        grupo.receitaVendas += d.totalRS;
        grupo.custoGadoVendido += d.totalAnimais * custoMedio;
    });

    caixaLancamentosCacheAdmin.forEach(l => {
        if (l.loteNome) return; // despesas/receitas com lote já viram custo do gado vendido daquele lote
        let dm = extrairMesAnoDaData(l.data);
        if (!dm) return;
        let grupo = grupoDoMes(dm.ano, dm.mes);
        grupo.despesasGerais += (l.tipo === "saida" ? l.valor : -l.valor);
    });

    let chaves = Object.keys(porMes).sort().reverse();
    if (chaves.length === 0) {
        corpo.innerHTML = `<tr><td colspan="5">Nenhum dado disponível ainda.</td></tr>`;
        return;
    }

    function formatarResultado(valor, semMovimentoDeResultado) {
        // mês que só teve compra/insumo/transferência (nenhuma venda, nenhuma
        // despesa geral) não é "lucro zero" -- é "ainda não vendeu nada" --
        // mostra neutro em vez do ▲ verde, que ia parecer lucro de verdade
        if (semMovimentoDeResultado) return `<span style="color:#999">— (sem vendas neste mês)</span>`;
        let positivo = valor >= 0;
        return `<span style="color:${positivo ? '#0ca30c' : '#d03b3b'}">${positivo ? '▲' : '▼'} R$ ${formatarMoeda(Math.abs(valor))}</span>`;
    }

    corpo.innerHTML = chaves.map(chave => {
        let g = porMes[chave];
        let resultado = g.receitaVendas - g.custoGadoVendido - g.despesasGerais;
        let semMovimentoDeResultado = g.receitaVendas === 0 && g.custoGadoVendido === 0 && g.despesasGerais === 0;
        return `
            <tr>
                <td>${NOMES_MESES_RESULTADO[g.mes]}/${g.ano}</td>
                <td>R$ ${formatarMoeda(g.receitaVendas)}</td>
                <td>R$ ${formatarMoeda(g.custoGadoVendido)}</td>
                <td>R$ ${formatarMoeda(g.despesasGerais)}</td>
                <td>${formatarResultado(resultado, semMovimentoDeResultado)}</td>
            </tr>
        `;
    }).join("");
}

// ========================================
// EVOLUÇÃO DO PATRIMÔNIO (visual, mês a mês)
// ========================================
// Reconstrói o Patrimônio Total como ele estava no FIM de cada mês que
// teve alguma movimentação, e calcula a variação % em relação ao mês
// anterior — é a resposta visual pra "quanto cresceu ou caiu esse mês".
// O estoque parado no almoxarifado só entra no mês mais recente (é só um
// saldo atual, não temos histórico de saldo por data), então meses
// passados ficam levemente subestimados nesse componente — irrelevante
// pra maioria dos ranchos, que não costumam manter muito parado ali.
async function mostrarEvolucaoPatrimonio() {
    let lista = document.getElementById("listaEvolucaoPatrimonio");
    if (!lista) return;

    await carregarCachesFinanceirasDashboard();

    let mesesVistos = new Set();
    function registrarMes(dataStr) {
        let dm = extrairMesAnoDaData(dataStr);
        if (dm) mesesVistos.add(chaveMes(dm.ano, dm.mes) + "|" + dm.ano + "|" + dm.mes);
    }
    if (saldoInicialCache.valor) registrarMes(saldoInicialCache.data);
    relatorios.forEach(r => registrarMes(r.data));
    estoqueEntradasCacheAdmin.forEach(e => registrarMes(e.data));
    estoqueSaidasCacheAdmin.forEach(s => registrarMes(s.data));
    caixaLancamentosCacheAdmin.forEach(l => registrarMes(l.data));

    let meses = Array.from(mesesVistos).map(item => {
        let [chave, ano, mes] = item.split("|");
        return { chave, ano: parseInt(ano, 10), mes: parseInt(mes, 10) };
    }).sort((a, b) => a.chave < b.chave ? -1 : (a.chave > b.chave ? 1 : 0));

    if (meses.length === 0) {
        lista.innerHTML = `<p class="loginSubtitulo" style="text-align:left">Nenhum dado disponível ainda.</p>`;
        return;
    }

    let agora = new Date();
    let hojeISO = agora.toISOString().slice(0, 10);
    let chaveMesDeHoje = chaveMes(agora.getFullYear(), agora.getMonth());
    let ultimaChave = meses[meses.length - 1].chave;

    for (let m of meses) {
        let ultimoDiaDoMes = new Date(m.ano, m.mes + 1, 0).getDate();
        let fimDoMesISO = `${m.ano}-${String(m.mes + 1).padStart(2, "0")}-${String(ultimoDiaDoMes).padStart(2, "0")}`;
        // só o mês CORRENTE corta em "hoje" (ele ainda não acabou). Meses
        // futuros (lançamentos com data adiantada) usam o próprio fim do
        // mês normalmente — sem isso, todo mês depois do atual "congelava"
        // no mesmo valor de hoje, escondendo a evolução real desses dados.
        let corteISO = m.chave === chaveMesDeHoje ? hojeISO : fimDoMesISO;

        let caixa = calcularCaixaAcumulado(corteISO);
        let porLote = agregarCustoLotesFinanceiro(corteISO);
        let rebanho = valorRebanhoVivo(porLote);
        let estoqueAlmox = (m.chave === ultimaChave)
            ? produtosCacheAdmin.reduce((soma, p) => soma + (p.saldoAtual || 0) * (p.custoMedioUnitario || 0), 0)
            : 0;

        m.patrimonio = caixa + rebanho + estoqueAlmox + valorBensNaData(corteISO);
    }

    for (let i = 0; i < meses.length; i++) {
        let anterior = i > 0 ? meses[i - 1].patrimonio : null;
        meses[i].variacaoAbs = anterior !== null ? meses[i].patrimonio - anterior : null;
        meses[i].variacaoPct = (anterior !== null && anterior !== 0) ? (meses[i].variacaoAbs / Math.abs(anterior)) * 100 : null;
    }

    let maxAbs = Math.max(1, ...meses.map(m => Math.abs(m.patrimonio)));

    lista.innerHTML = meses.map(m => {
        let positivo = m.patrimonio >= 0;
        let largura = Math.min(100, (Math.abs(m.patrimonio) / maxAbs) * 100);
        let variacaoHtml;
        if (m.variacaoAbs === null) {
            variacaoHtml = `<span class="patrimonioVariacao" style="color:#999">— primeiro mês</span>`;
        } else {
            let cresceu = m.variacaoAbs >= 0;
            let pctTexto = m.variacaoPct !== null ? Math.abs(m.variacaoPct).toFixed(1).replace(".", ",") + "%" : "—";
            variacaoHtml = `<span class="patrimonioVariacao" style="color:${cresceu ? '#0ca30c' : '#d03b3b'}">${cresceu ? '▲' : '▼'} ${pctTexto}</span>`;
        }
        return `
            <div class="patrimonioLinha">
                <span class="patrimonioRotulo">${NOMES_MESES_RESULTADO[m.mes].slice(0, 3)}/${m.ano}</span>
                <div class="patrimonioTrilha"><div class="patrimonioFill" style="width:${largura}%; background:${positivo ? '#2a78d6' : '#d03b3b'}"></div></div>
                <span class="patrimonioValor">R$ ${formatarMoeda(m.patrimonio)}</span>
                ${variacaoHtml}
            </div>
        `;
    }).join("");
}

// ========================================
// SUB-CAIXAS (centros de custo — nunca mudam os totais gerais)
// ========================================
// Ex: "Caixa do Caminhão" — é só uma etiqueta em cima dos MESMOS lançamentos
// que já contam pro Caixa Acumulado/Patrimônio/Resultado Mensal. Essa tela
// nunca filtra nem subtrai nada desses totais — só reagrupa pra dar uma
// visão de "esse centro de custo dá lucro ou prejuízo".
let subCaixasCacheAdmin = [];

async function carregarSubCaixasAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/sub-caixas`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        subCaixasCacheAdmin = await resp.json();
        return subCaixasCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function criarSubCaixaRapido() {
    let input = document.getElementById("novoSubCaixaInput");
    let erroEl = document.getElementById("subCaixaErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }
    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }
        let nome = input.value.trim();
        if (!nome) { mostrarErro("Informe o nome do sub-caixa."); return; }
        let resp = await fetch(`${API_URL}/api/sub-caixas`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ nome })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao criar sub-caixa (HTTP ${resp.status}).`); return; }
        input.value = "";
        if (erroEl) erroEl.style.display = "none";
        await mostrarSubCaixas();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function alternarAtivoSubCaixa(id, novoAtivo) {
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/sub-caixas/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao atualizar sub-caixa (HTTP ${resp.status}).`); return; }
        await mostrarSubCaixas();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

async function excluirSubCaixa(id, nome) {
    if (!await confirmarModerno(`Excluir o sub-caixa "${nome}"? Os lançamentos já marcados com ele continuam existindo normalmente, só perdem essa etiqueta.`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/sub-caixas/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir sub-caixa (HTTP ${resp.status}).`); return; }
        await mostrarSubCaixas();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// resumo por sub-caixa: soma os MESMOS lançamentos que já entram no Caixa
// Acumulado (histórico inteiro, sem filtro de data) — é só uma visão
// reagrupada, nunca influencia nenhum total do sistema.
async function mostrarSubCaixas() {
    let corpo = document.getElementById("corpoTabelaSubCaixas");
    let lista = document.getElementById("listaSubCaixasCadastro");
    if (!corpo && !lista) return;

    await Promise.all([carregarSubCaixasAdmin(), carregarCaixaLancamentosAdmin()]);

    let I = ICONES_CAIXA;
    let esc = escaparHtmlPesagem;
    let porSubCaixa = {};
    caixaLancamentosCacheAdmin.forEach(l => {
        if (!l.subCaixaNome) return;
        if (!porSubCaixa[l.subCaixaNome]) porSubCaixa[l.subCaixaNome] = { entradas: 0, saidas: 0, qtd: 0 };
        if (l.tipo === "saida") porSubCaixa[l.subCaixaNome].saidas += l.valor;
        else porSubCaixa[l.subCaixaNome].entradas += l.valor;
        porSubCaixa[l.subCaixaNome].qtd++;
    });

    if (lista) {
        lista.innerHTML = subCaixasCacheAdmin.length === 0
            ? `<p class="fcVazioPequeno">Nenhum sub-caixa cadastrado ainda.</p>`
            : subCaixasCacheAdmin.map(s => {
                let r = porSubCaixa[s.nome] || { entradas: 0, saidas: 0, qtd: 0 };
                let saldo = r.entradas - r.saidas;
                return `
                <div class="fcSubItem${s.ativo ? "" : " fcSubItemInativo"}">
                    <div class="fcSubNome"><b>${esc(s.nome)}</b><small>${r.qtd} ${r.qtd === 1 ? "lançamento" : "lançamentos"}${s.ativo ? "" : " · inativo"}</small></div>
                    <div class="fcSubNumeros">
                        <span class="fcEntrada">+ R$ ${formatarMoeda(r.entradas)}</span>
                        <span class="fcSaida">− R$ ${formatarMoeda(r.saidas)}</span>
                        <b class="${saldo >= 0 ? "fcEntrada" : "fcSaida"}">${saldo >= 0 ? "" : "− "}R$ ${formatarMoeda(Math.abs(saldo))}</b>
                    </div>
                    <div class="fcSubAcoes">
                        <button class="ltBtnIcone ${s.ativo ? "ltBtnDesativar" : "ltBtnAtivar"}" onclick='alternarAtivoSubCaixa(${jsonAtributo(s.id)}, ${!s.ativo})' title="${s.ativo ? "Desativar" : "Reativar"}" aria-label="${s.ativo ? "Desativar" : "Reativar"}">${s.ativo ? I.desativar : I.ativar}</button>
                        <button class="ltBtnIcone ltBtnExcluir" onclick='excluirSubCaixa(${jsonAtributo(s.id)}, ${jsonAtributo(s.nome)})' title="Excluir" aria-label="Excluir">${I.lixeira}</button>
                    </div>
                </div>`;
            }).join("");
    }

    if (!corpo) return;
    // sub-caixa excluído que ainda tem lançamentos marcados com o nome dele
    let orfaos = Object.keys(porSubCaixa).filter(n => !subCaixasCacheAdmin.some(s => s.nome === n)).sort();
    corpo.innerHTML = orfaos.length === 0 ? "" : `<p class="fcVazioPequeno">Lançamentos marcados com sub-caixas que não existem mais: ${orfaos.map(n => {
        let r = porSubCaixa[n]; let saldo = r.entradas - r.saidas;
        return `<b>${esc(n)}</b> (${saldo >= 0 ? "" : "−"}R$ ${formatarMoeda(Math.abs(saldo))})`;
    }).join(", ")}</p>`;
}

// ========================================
// PATRIMÔNIO — BENS (veículos, caminhões, máquinas, terra...)
// ========================================
// O valor atual de cada bem em uso entra no Patrimônio Total do Dashboard.
// Cadastrar/vender um bem NÃO mexe no caixa: o dinheiro da compra ou da venda
// continua sendo lançado no Fluxo de Caixa / Contas a Pagar.
const CATEGORIAS_BEM = {
    "veiculo": {
        "nome": "Veículo (carro, moto)",
        "cor": "#60a5fa",
        "icone": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 17h14v-5l-2-5H7l-2 5z\"></path><path d=\"M5 12h14\"></path><circle cx=\"8\" cy=\"17\" r=\"2\"></circle><circle cx=\"16\" cy=\"17\" r=\"2\"></circle></svg>"
    },
    "caminhao": {
        "nome": "Caminhão",
        "cor": "#fb923c",
        "icone": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M2 6h12v10H2z\"></path><path d=\"M14 9h4l3 3v4h-7z\"></path><circle cx=\"6\" cy=\"17.5\" r=\"2\"></circle><circle cx=\"17\" cy=\"17.5\" r=\"2\"></circle></svg>"
    },
    "maquina": {
        "nome": "Trator / máquina",
        "cor": "#fbbf24",
        "icone": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"7\" cy=\"16\" r=\"4\"></circle><circle cx=\"18\" cy=\"17\" r=\"3\"></circle><path d=\"M7 12V6h6l2 6\"></path><path d=\"M11 12h7v2\"></path><path d=\"M13 6V4\"></path></svg>"
    },
    "implemento": {
        "nome": "Implemento (grade, plantadeira...)",
        "cor": "#a78bfa",
        "icone": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 8h18\"></path><path d=\"M6 8v9M10 8v9M14 8v9M18 8v9\"></path><path d=\"M12 8V4\"></path></svg>"
    },
    "imovel": {
        "nome": "Terra / imóvel",
        "cor": "#34d399",
        "icone": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 20l6-12 4 7 3-4 5 9z\"></path><circle cx=\"17\" cy=\"6\" r=\"2\"></circle></svg>"
    },
    "benfeitoria": {
        "nome": "Benfeitoria (curral, galpão, cerca)",
        "cor": "#2dd4bf",
        "icone": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 21V10l9-6 9 6v11\"></path><path d=\"M3 21h18\"></path><path d=\"M8 21v-6h8v6\"></path><path d=\"M8 18h8\"></path></svg>"
    },
    "equipamento": {
        "nome": "Equipamento (balança, gerador...)",
        "cor": "#22d3ee",
        "icone": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z\"></path></svg>"
    },
    "outro": {
        "nome": "Outro",
        "cor": "#94a3b8",
        "icone": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z\"></path></svg>"
    }
};
const ICONES_BENS = {
    "predio": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 21h18\"></path><path d=\"M5 21V10l7-5 7 5v11\"></path><path d=\"M9 21v-5h6v5\"></path><path d=\"M10 10h4\"></path></svg>",
    "mais": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"></path></svg>",
    "busca": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"></line></svg>",
    "editar": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 20h9\"></path><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"></path></svg>",
    "lixeira": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 6h18\"></path><path d=\"M8 6V4h8v2\"></path><path d=\"M19 6l-1 14H6L5 6\"></path><path d=\"M10 11v6M14 11v6\"></path></svg>",
    "tendencia": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 17l6-6 4 4 8-8\"></path><path d=\"M15 7h6v6\"></path></svg>",
    "calendario": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2\"></rect><path d=\"M16 2v4M8 2v4M3 10h18\"></path></svg>",
    "moeda": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5\"></path><path d=\"M12 6v2M12 16v2\"></path></svg>",
    "vendido": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z\"></path><path d=\"M7 7h.01\"></path></svg>"
};
let bensCacheAdmin = [];
let filtroSituacaoBens = "ativo";
let bemEditandoId = null;
let categoriaBemEscolhida = "veiculo";
let situacaoBemEscolhida = "ativo";

async function carregarBensAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/bens`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        bensCacheAdmin = await resp.json();
        return bensCacheAdmin;
    } catch (e) {
        return [];
    }
}

// valor dos bens que a fazenda TINHA numa data ("yyyy-mm-dd"; sem data = hoje):
// comprado até ali (ou sem data de compra) e ainda não vendido/baixado nela
function valorBensNaData(dataISO) {
    return bensCacheAdmin.reduce((soma, b) => {
        if (dataISO && b.dataAquisicao && b.dataAquisicao > dataISO) return soma;
        let saiu = b.situacao !== "ativo" && (!dataISO || !b.dataBaixa || b.dataBaixa <= dataISO);
        return saiu ? soma : soma + (Number(b.valorAtual) || 0);
    }, 0);
}

// "1.234,56" / "1234,56" / "1234.56" / "R$ 80" -> número
function lerValorBR(texto) {
    let s = String(texto || "").replace(/[R$\s]/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    // "172.000" / "1.500.000" sem vírgula: no Brasil o ponto é de milhar
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    let n = Number(s);
    return Number.isFinite(n) ? n : NaN;
}

async function abrirTelaPatrimonio() {
    await carregarBensAdmin();
    mostrarBens();
}

function filtrarSituacaoBens(situacao) {
    filtroSituacaoBens = situacao;
    document.querySelectorAll("#telaPatrimonio .ptChipsSituacao .ltChip").forEach(b => b.classList.toggle("ltChipAtivo", b.dataset.situacao === situacao));
    mostrarBens();
}

function mostrarBens() {
    let grade = document.getElementById("ptGrade");
    if (!grade) return;
    let esc = escaparHtmlPesagem;
    let I = ICONES_BENS;
    let rs = v => "R$ " + formatarMoeda(v);
    let emUso = bensCacheAdmin.filter(b => b.situacao === "ativo");
    let total = emUso.reduce((s, b) => s + b.valorAtual, 0);
    let set = (id, v) => { let el = document.getElementById(id); if (el) el.innerText = v; };

    set("ptValorTotal", rs(total));
    set("ptResumo", `${emUso.length} ${emUso.length === 1 ? "bem em uso" : "bens em uso"} · ${rs(total)}`);
    let comCompra = emUso.filter(b => b.valorAquisicao !== null && b.valorAquisicao !== undefined);
    let pago = comCompra.reduce((s, b) => s + b.valorAquisicao, 0);
    let variacao = comCompra.reduce((s, b) => s + b.valorAtual - b.valorAquisicao, 0);
    set("ptValorPago", comCompra.length ? rs(pago) : "—");
    let elVar = document.getElementById("ptVariacao");
    if (elVar) {
        elVar.innerText = comCompra.length ? (variacao >= 0 ? "+ " : "− ") + rs(Math.abs(variacao)) : "—";
        elVar.className = comCompra.length ? (variacao >= 0 ? "fcEntrada" : "fcSaida") : "";
    }
    let linhaVar = document.querySelector("#ptLinhaVariacao span");
    if (linhaVar) linhaVar.innerText = comCompra.length && variacao < 0 ? "Depreciação" : "Valorização";
    set("ptQtdBaixados", bensCacheAdmin.length - emUso.length);

    // composição por categoria (barra empilhada + legenda)
    let porCategoria = {};
    emUso.forEach(b => { porCategoria[b.categoria] = (porCategoria[b.categoria] || 0) + b.valorAtual; });
    let cats = Object.keys(porCategoria).sort((a, b) => porCategoria[b] - porCategoria[a]);
    let cat = c => CATEGORIAS_BEM[c] || CATEGORIAS_BEM.outro;
    let barra = document.getElementById("ptBarraEmpilhada");
    if (barra) barra.innerHTML = total > 0
        ? cats.map(c => `<i style="width:${porCategoria[c] / total * 100}%; background:${cat(c).cor}" title="${esc(cat(c).nome)}"></i>`).join("")
        : "";
    let legenda = document.getElementById("ptLegenda");
    if (legenda) legenda.innerHTML = cats.length
        ? cats.map(c => `<span><i style="background:${cat(c).cor}"></i>${esc(cat(c).nome.split(" (")[0])} <b>${Math.round(porCategoria[c] / total * 100)}%</b></span>`).join("")
        : `<span class="ptLegendaVazia">Cadastre o primeiro bem para ver a divisão.</span>`;

    // filtro de categoria: só as que existem
    let sel = document.getElementById("ptFiltroCategoria");
    if (sel) {
        let atual = sel.value;
        let existentes = Object.keys(CATEGORIAS_BEM).filter(c => bensCacheAdmin.some(b => b.categoria === c));
        sel.innerHTML = `<option value="">Categoria: Todas</option>` + existentes.map(c => `<option value="${c}">${esc(CATEGORIAS_BEM[c].nome)}</option>`).join("");
        sel.value = existentes.includes(atual) ? atual : "";
        sel.classList.toggle("ltFiltroUsado", !!sel.value);
    }
    let filtroCat = sel ? sel.value : "";
    let busca = (document.getElementById("ptBusca")?.value || "").trim().toLowerCase();
    let lista = bensCacheAdmin.filter(b => {
        if (filtroSituacaoBens === "ativo" && b.situacao !== "ativo") return false;
        if (filtroSituacaoBens === "baixados" && b.situacao === "ativo") return false;
        if (filtroCat && b.categoria !== filtroCat) return false;
        if (busca && ![b.nome, b.marca, b.modelo, b.identificacao, b.observacoes, cat(b.categoria).nome].some(t => String(t || "").toLowerCase().includes(busca))) return false;
        return true;
    }).sort((a, b) => (a.situacao === "ativo" ? 0 : 1) - (b.situacao === "ativo" ? 0 : 1) || b.valorAtual - a.valorAtual);

    if (bensCacheAdmin.length === 0) {
        grade.innerHTML = `
            <div class="ptVazio">
                <span class="ptVazioIcone">${I.predio}</span>
                <b>Nenhum bem cadastrado ainda</b>
                <span>Cadastre caminhões, carros, tratores, terra, curral... com o valor de cada um — ele passa a contar no Patrimônio Total.</span>
                <button class="acaoRel almBtnEntrada" onclick="abrirModalBem()">${I.mais}Cadastrar o primeiro bem</button>
            </div>`;
        return;
    }
    if (lista.length === 0) {
        grade.innerHTML = `<p class="ltVazio">Nenhum bem nesse filtro.</p>`;
        return;
    }
    let dataBR = iso => iso ? iso.split("-").reverse().join("/") : "";
    grade.innerHTML = lista.map(b => {
        let c = cat(b.categoria);
        let emUsoBem = b.situacao === "ativo";
        let detalhes = [b.marca, b.modelo, b.ano].filter(Boolean).map(esc).join(" · ");
        let temCompra = b.valorAquisicao !== null && b.valorAquisicao !== undefined;
        let dif = temCompra ? b.valorAtual - b.valorAquisicao : 0;
        let pct = temCompra && b.valorAquisicao > 0 ? dif / b.valorAquisicao * 100 : null;
        let parte = emUsoBem && total > 0 ? b.valorAtual / total * 100 : 0;
        let selo = emUsoBem ? `<span class="ltStatus ltStatusAtivo">Em uso</span>`
            : `<span class="ltStatus ptStatusBaixado">${b.situacao === "vendido" ? "Vendido" : "Baixado"}</span>`;
        return `
        <article class="ptCartao${emUsoBem ? "" : " ptCartaoBaixado"}" style="--corBem:${c.cor}">
            <header class="ptCartaoTopo">
                <span class="ptCartaoIcone">${c.icone}</span>
                <div class="ptCartaoNome">
                    <h4 title="${esc(b.nome)}">${esc(b.nome)}</h4>
                    <small>${esc(c.nome.split(" (")[0])}${detalhes ? " · " + detalhes : ""}</small>
                </div>
                ${selo}
            </header>
            ${b.identificacao ? `<span class="ptPlaca" title="Placa / identificação">${esc(b.identificacao)}</span>` : ""}
            <div class="ptValorBloco">
                <span class="ptValorRotulo">${emUsoBem ? "Valor atual" : (b.situacao === "vendido" ? "Valor quando vendido" : "Último valor")}</span>
                <b class="ptValor">${rs(b.valorAtual)}</b>
                ${emUsoBem && total > 0 ? `<div class="ptParte"><div class="almBarra"><i style="width:${Math.max(2, parte)}%; background:${c.cor}"></i></div><small>${Math.round(parte)}% dos bens</small></div>` : ""}
            </div>
            <div class="ptInfos">
                ${temCompra || b.dataAquisicao ? `<div><span>${I.calendario}Compra</span><b>${b.dataAquisicao ? dataBR(b.dataAquisicao) : "—"}${temCompra ? " · " + rs(b.valorAquisicao) : ""}</b></div>` : ""}
                ${pct !== null ? `<div><span>${I.tendencia}${dif >= 0 ? "Valorizou" : "Desvalorizou"}</span><b class="${dif >= 0 ? "fcEntrada" : "fcSaida"}">${dif >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(0)}% (${rs(Math.abs(dif))})</b></div>` : ""}
                ${!emUsoBem ? `<div><span>${I.vendido}${b.situacao === "vendido" ? "Vendido em" : "Baixado em"}</span><b>${dataBR(b.dataBaixa)}${b.valorBaixa !== null && b.valorBaixa !== undefined ? " · " + rs(b.valorBaixa) : ""}</b></div>` : ""}
            </div>
            ${b.observacoes ? `<p class="ptObs">${esc(b.observacoes)}</p>` : ""}
            <footer class="ltCartaoAcoes">
                <button class="usBtnEditar" onclick='abrirModalBem(${jsonAtributo(b.id)})'>${I.editar}<span>Editar</span></button>
                <button class="ltBtnIcone ltBtnExcluir" onclick='excluirBem(${jsonAtributo(b.id)}, ${jsonAtributo(b.nome)})' title="Excluir do cadastro" aria-label="Excluir do cadastro">${I.lixeira}</button>
            </footer>
        </article>`;
    }).join("");
}

function escolherCategoriaBem(categoria) {
    categoriaBemEscolhida = categoria;
    document.querySelectorAll("#ptCategoriasEscolha .ptCategoria").forEach(b => b.classList.toggle("ptCategoriaAtiva", b.dataset.categoria === categoria));
}

function escolherSituacaoBem(situacao) {
    situacaoBemEscolhida = situacao;
    document.querySelectorAll("#modalBem .ptSituacaoEscolha .ltChip").forEach(b => b.classList.toggle("ltChipAtivo", b.dataset.situacao === situacao));
    let baixa = situacao !== "ativo";
    document.getElementById("bemBaixaCampos").style.display = baixa ? "" : "none";
    document.getElementById("bemAvisoBaixa").style.display = baixa ? "" : "none";
    document.getElementById("bemDataBaixaRotulo").innerText = situacao === "vendido" ? "Data da venda" : "Data da baixa";
    document.getElementById("bemValorBaixaBloco").style.display = situacao === "vendido" ? "" : "none";
    if (baixa && !document.getElementById("bemDataBaixaInput").value) document.getElementById("bemDataBaixaInput").value = cpDataLocalISO(new Date());
}

function abrirModalBem(id) {
    let b = id ? bensCacheAdmin.find(x => x.id === id) : null;
    bemEditandoId = b ? b.id : null;
    let valorCampo = v => v === null || v === undefined ? "" : formatarMoeda(v);
    document.getElementById("modalBemTitulo").innerText = b ? "Editar bem" : "Cadastrar bem";
    document.getElementById("ptCategoriasEscolha").innerHTML = Object.entries(CATEGORIAS_BEM).map(([chave, c]) => `
        <button type="button" class="ptCategoria" data-categoria="${chave}" style="--corBem:${c.cor}" onclick="escolherCategoriaBem('${chave}')">
            <span>${c.icone}</span><small>${escaparHtmlPesagem(c.nome.split(" (")[0])}</small>
        </button>`).join("");
    escolherCategoriaBem(b ? b.categoria : "veiculo");
    document.getElementById("bemNomeInput").value = b ? b.nome : "";
    document.getElementById("bemMarcaInput").value = b && b.marca ? b.marca : "";
    document.getElementById("bemModeloInput").value = b && b.modelo ? b.modelo : "";
    document.getElementById("bemAnoInput").value = b && b.ano ? b.ano : "";
    document.getElementById("bemIdentificacaoInput").value = b && b.identificacao ? b.identificacao : "";
    document.getElementById("bemDataAquisicaoInput").value = b && b.dataAquisicao ? b.dataAquisicao : "";
    document.getElementById("bemValorAquisicaoInput").value = b ? valorCampo(b.valorAquisicao) : "";
    document.getElementById("bemValorAtualInput").value = b ? valorCampo(b.valorAtual) : "";
    document.getElementById("bemDataBaixaInput").value = b && b.dataBaixa ? b.dataBaixa : "";
    document.getElementById("bemValorBaixaInput").value = b ? valorCampo(b.valorBaixa) : "";
    document.getElementById("bemObservacoesInput").value = b && b.observacoes ? b.observacoes : "";
    escolherSituacaoBem(b ? b.situacao : "ativo");
    let erroEl = document.getElementById("bemErro");
    erroEl.style.display = "none"; erroEl.innerText = "";
    novaChaveIdempotencia("modalBem");
    document.getElementById("modalBem").style.display = "flex";
    setTimeout(() => document.getElementById("bemNomeInput").focus(), 50);
}

function fecharModalBem() {
    document.getElementById("modalBem").style.display = "none";
    bemEditandoId = null;
}

async function salvarBem() {
    let erroEl = document.getElementById("bemErro");
    let mostrarErro = msg => { erroEl.innerText = msg; erroEl.style.display = "block"; };
    let token = obterToken();
    if (!token) { mostrarErro("Sua sessão expirou."); return; }
    let valor = id => document.getElementById(id).value.trim();
    let valorAtual = lerValorBR(valor("bemValorAtualInput"));
    let valorAquisicao = lerValorBR(valor("bemValorAquisicaoInput"));
    let valorBaixa = lerValorBR(valor("bemValorBaixaInput"));
    if (!valor("bemNomeInput")) { mostrarErro("Informe o nome do bem."); return; }
    if (valorAtual === null || Number.isNaN(valorAtual)) { mostrarErro("Informe quanto o bem vale hoje (valor atual)."); return; }
    if (Number.isNaN(valorAquisicao) || Number.isNaN(valorBaixa)) { mostrarErro("Confira os valores digitados."); return; }
    let corpo = {
        id: bemEditandoId ? undefined : obterChaveIdempotencia("modalBem"),
        categoria: categoriaBemEscolhida, nome: valor("bemNomeInput"), marca: valor("bemMarcaInput"), modelo: valor("bemModeloInput"),
        ano: valor("bemAnoInput") || null, identificacao: valor("bemIdentificacaoInput"),
        dataAquisicao: valor("bemDataAquisicaoInput") || null, valorAquisicao,
        valorAtual, situacao: situacaoBemEscolhida,
        dataBaixa: situacaoBemEscolhida !== "ativo" ? (valor("bemDataBaixaInput") || null) : null,
        valorBaixa: situacaoBemEscolhida === "vendido" ? valorBaixa : null,
        observacoes: valor("bemObservacoesInput")
    };
    try {
        let resp = await fetch(`${API_URL}/api/bens${bemEditandoId ? "/" + bemEditandoId : ""}`, {
            method: bemEditandoId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify(corpo)
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar (HTTP ${resp.status}).`); return; }
        fecharModalBem();
        await abrirTelaPatrimonio();
        if (typeof mostrarPatrimonio === "function") mostrarPatrimonio();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function excluirBem(id, nome) {
    if (!await confirmarModerno(`Excluir "${nome}" do cadastro? Se ele foi vendido ou perdido, prefira Editar e marcar como Vendido/Baixado — assim o histórico do patrimônio continua certo.`)) return;
    try {
        let resp = await fetch(`${API_URL}/api/bens/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + obterToken() } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await abrirTelaPatrimonio();
        if (typeof mostrarPatrimonio === "function") mostrarPatrimonio();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ========================================
// CATEGORIAS FINANCEIRAS (lista fechada por fazenda)
// ========================================
const ICONES_CATEGORIAS = {
    "pasta": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path></svg>",
    "cadeado": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"></rect><path d=\"M8 11V7a4 4 0 0 1 8 0v4\"></path></svg>",
    "juntar": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 3v4a4 4 0 0 0 4 4h0a4 4 0 0 1 4 4v6\"></path><path d=\"M16 3v4a4 4 0 0 1-4 4\"></path><path d=\"M13 18l3 3 3-3\"></path></svg>",
    "grafico": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 3v18h18\"></path><rect x=\"7\" y=\"12\" width=\"3\" height=\"6\"></rect><rect x=\"12\" y=\"8\" width=\"3\" height=\"10\"></rect><rect x=\"17\" y=\"5\" width=\"3\" height=\"13\"></rect></svg>"
};
let categoriasCacheAdmin = [];
let categoriasForaDaLista = [];
let abaCategorias = "saida";

async function carregarCategoriasFinanceiras() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/categorias-financeiras`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return categoriasCacheAdmin;
        let dados = await resp.json();
        categoriasCacheAdmin = dados.categorias || [];
        categoriasForaDaLista = dados.foraDaLista || [];
    } catch (e) {}
    return categoriasCacheAdmin;
}

// select de categoria (só as ativas do tipo); mantém a escolha se ainda existir
function preencherSelectCategoria(select, tipo, atual) {
    if (!select) return;
    let esc = escaparHtmlPesagem;
    let lista = categoriasCacheAdmin.filter(c => c.ativo && c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    select.innerHTML = `<option value="">Escolha a categoria…</option>` + lista.map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join("");
    select.value = lista.some(c => c.nome === atual) ? atual : "";
}

function preencherCategoriasLancamento() {
    let tipo = document.getElementById("lancamentoTipoInput").value;
    let sel = document.getElementById("lancamentoCategoriaInput");
    preencherSelectCategoria(sel, tipo, sel.value);
}

async function abrirModalCategorias() {
    await carregarCategoriasFinanceiras();
    document.getElementById("catErro").style.display = "none";
    document.getElementById("catNovaInput").value = "";
    mostrarCategorias();
    document.getElementById("modalCategorias").style.display = "flex";
}

async function fecharModalCategorias() {
    document.getElementById("modalCategorias").style.display = "none";
    // as janelas de lançamento abertas por baixo pegam a lista nova
    await carregarCategoriasFinanceiras();
    preencherCategoriasLancamento();
    let selConta = document.getElementById("cpCategoriaInput");
    preencherSelectCategoria(selConta, "saida", selConta.value);
}

function trocarAbaCategorias(tipo) {
    abaCategorias = tipo;
    document.querySelectorAll("#modalCategorias .catAbas .ltChip").forEach(b => b.classList.toggle("ltChipAtivo", b.dataset.tipo === tipo));
    mostrarCategorias();
}

function mostrarCategorias() {
    let esc = escaparHtmlPesagem;
    let I = ICONES_CATEGORIAS;
    let lista = categoriasCacheAdmin.filter(c => c.tipo === abaCategorias);
    let ativas = lista.filter(c => c.ativo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    let opcoes = ativas.map(c => `<option value="${esc(c.nome)}">${esc(c.nome)}</option>`).join("");
    let fora = categoriasForaDaLista.filter(f => f.tipo === abaCategorias);
    document.getElementById("catForaDaLista").innerHTML = fora.length === 0 ? "" : `
        <div class="catFora">
            <b>${I.juntar}Organizar lançamentos antigos</b>
            <span>Estes nomes foram digitados à mão e não estão na lista. Junte cada um numa categoria — os lançamentos passam pra ela.</span>
            ${fora.map((f, i) => `
            <div class="catForaLinha">
                <span class="catForaNome">${f.nome ? "“" + esc(f.nome) + "”" : "<i>Sem categoria</i>"} <small>${f.usos} ${f.usos === 1 ? "uso" : "usos"}</small></span>
                <select id="catPara${i}"><option value="">Juntar em…</option>${opcoes}</select>
                <button class="acaoRel salBtnAdiantar" onclick='juntarCategoria(${jsonAtributo(f.nome)}, ${jsonAtributo(f.tipo)}, "catPara${i}")'>Juntar</button>
            </div>`).join("")}
        </div>`;
    document.getElementById("catLista").innerHTML = lista.length === 0 ? `<p class="vmVazio">Nenhuma categoria.</p>` :
        lista.sort((a, b) => (b.ativo - a.ativo) || (b.sistema - a.sistema) || a.nome.localeCompare(b.nome, "pt-BR")).map(c => `
        <div class="catItem${c.ativo ? "" : " catItemInativo"}">
            <span class="catNome">${c.sistema ? `<span class="catCadeado" title="Usada pelo próprio sistema">${I.cadeado}</span>` : ""}${esc(c.nome)}</span>
            <small class="catUsos">${c.usos} ${c.usos === 1 ? "uso" : "usos"}${c.ativo ? "" : " · desativada"}</small>
            <span class="catAcoes">${c.sistema ? `<small class="catSistema">do sistema</small>` : `
                <button class="catBtn" onclick='renomearCategoria(${jsonAtributo(c.id)}, ${jsonAtributo(c.nome)})'>Renomear</button>
                <button class="catBtn" onclick='alternarCategoria(${jsonAtributo(c.id)}, ${!c.ativo})'>${c.ativo ? "Desativar" : "Reativar"}</button>
                ${c.usos === 0 ? `<button class="catBtn catBtnExcluir" onclick='excluirCategoria(${jsonAtributo(c.id)}, ${jsonAtributo(c.nome)})'>Excluir</button>` : ""}`}</span>
        </div>`).join("");
}

async function requisicaoCategoria(metodo, rota, corpo) {
    let erro = document.getElementById("catErro");
    erro.style.display = "none";
    try {
        let resp = await fetch(`${API_URL}/api/categorias-financeiras${rota}`, {
            method: metodo,
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + obterToken() },
            body: corpo ? JSON.stringify(corpo) : undefined
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { erro.innerText = dados.erro || `Erro (HTTP ${resp.status}).`; erro.style.display = "block"; return null; }
        await carregarCategoriasFinanceiras();
        mostrarCategorias();
        return dados;
    } catch (e) {
        erro.innerText = "Erro de conexão: " + e.message; erro.style.display = "block";
        return null;
    }
}

async function criarCategoria() {
    let input = document.getElementById("catNovaInput");
    let nome = input.value.trim();
    if (!nome) return;
    if (await requisicaoCategoria("POST", "", { nome, tipo: abaCategorias })) input.value = "";
}

async function renomearCategoria(id, nomeAtual) {
    let novo = prompt(`Novo nome para "${nomeAtual}" (os lançamentos com esse nome mudam juntos):`, nomeAtual);
    if (novo === null || !novo.trim() || novo.trim() === nomeAtual) return;
    if (await requisicaoCategoria("PUT", "/" + id, { nome: novo.trim() })) atualizarTelasDepoisCategorias();
}

async function alternarCategoria(id, ativo) {
    await requisicaoCategoria("PUT", "/" + id, { ativo });
}

async function excluirCategoria(id, nome) {
    if (!await confirmarModerno(`Excluir a categoria "${nome}"?`)) return;
    await requisicaoCategoria("DELETE", "/" + id);
}

async function juntarCategoria(de, tipo, idSelect) {
    let para = document.getElementById(idSelect).value;
    if (!para) { let e = document.getElementById("catErro"); e.innerText = "Escolha em qual categoria juntar."; e.style.display = "block"; return; }
    if (!await confirmarModerno(`Passar todos os lançamentos ${de ? `"${de}"` : "sem categoria"} para "${para}"?`)) return;
    let r = await requisicaoCategoria("POST", "/unificar", { de, para, tipo });
    if (r) atualizarTelasDepoisCategorias();
}

// renomear/juntar muda a categoria de lançamentos que já estão nas telas
async function atualizarTelasDepoisCategorias() {
    await Promise.all([carregarCaixaLancamentosAdmin(), carregarContasPagarAdmin()]);
    if (document.getElementById("telaFluxoCaixa")?.classList.contains("ativa")) mostrarFluxoCaixa();
    if (document.getElementById("telaContasPagar")?.classList.contains("ativa")) mostrarContasPagar();
}

// ========================================
// FLUXO DE CAIXA
// ========================================
let caixaLancamentosCacheAdmin = [];
let estoqueEntradasCacheAdmin = [];

async function carregarCaixaLancamentosAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/caixa-lancamentos`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        caixaLancamentosCacheAdmin = await resp.json();
        return caixaLancamentosCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function carregarEstoqueEntradasAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/estoque-entradas`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        estoqueEntradasCacheAdmin = await resp.json();
        return estoqueEntradasCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function abrirTelaFluxoCaixa() {
    await Promise.all([carregarCaixaLancamentosAdmin(), carregarEstoqueEntradasAdmin(), carregarSaldoInicial()]);
    mostrarFluxoCaixa();
    mostrarSubCaixas();
}

const ICONES_CAIXA = {
    "carteira": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-4a2 2 0 0 0 0 4h4v4a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5\"></path><circle cx=\"17\" cy=\"14\" r=\".6\" fill=\"currentColor\"></circle></svg>",
    "imprimir": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><polyline points=\"6 9 6 2 18 2 18 9\"></polyline><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"></path><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"></rect></svg>",
    "mais": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"></path></svg>",
    "entrada": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 19V5\"></path><path d=\"M5 12l7 7 7-7\"></path></svg>",
    "saida": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14\"></path><path d=\"M5 12l7-7 7 7\"></path></svg>",
    "historico": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 12a9 9 0 1 0 3-6.7\"></path><path d=\"M3 4v5h5\"></path><path d=\"M12 7v5l3 2\"></path></svg>",
    "balanca": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3v18\"></path><path d=\"M5 7h14\"></path><path d=\"M5 7l-3 7a3 3 0 0 0 6 0z\"></path><path d=\"M19 7l-3 7a3 3 0 0 0 6 0z\"></path><path d=\"M8 21h8\"></path></svg>",
    "busca": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"></circle><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"></line></svg>",
    "lixeira": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 6h18\"></path><path d=\"M8 6V4h8v2\"></path><path d=\"M19 6l-1 14H6L5 6\"></path><path d=\"M10 11v6M14 11v6\"></path></svg>",
    "pasta": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path></svg>",
    "desativar": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M5.6 5.6l12.8 12.8\"></path></svg>",
    "ativar": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M8.5 12l2.5 2.5 4.5-5\"></path></svg>",
    "seta": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 9l6 6 6-6\"></path></svg>",
    "calendario": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2\"></rect><path d=\"M16 2v4M8 2v4M3 10h18\"></path></svg>",
    "tag": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z\"></path><circle cx=\"7\" cy=\"7\" r=\"1.3\" fill=\"currentColor\"></circle></svg>"
};
let filtroTipoCaixa = "";

function limparFiltrosCaixa() {
    document.getElementById("caixaDataInicio").value = "";
    document.getElementById("caixaDataFim").value = "";
    let busca = document.getElementById("caixaBusca");
    if (busca) busca.value = "";
    let selCat = document.getElementById("caixaFiltroCategoria");
    if (selCat) selCat.value = "";
    filtroTipoCaixa = "";
    marcarChipsCaixa("");
    mostrarFluxoCaixa();
}

function marcarChipsCaixa(periodo) {
    document.querySelectorAll("#telaFluxoCaixa .fcChipsPeriodo .ltChip").forEach(b => b.classList.toggle("ltChipAtivo", b.dataset.periodo === periodo));
    document.querySelectorAll("#telaFluxoCaixa .fcChipsTipo .ltChip").forEach(b => b.classList.toggle("ltChipAtivo", b.dataset.tipo === filtroTipoCaixa));
}

// período pronto (usa o mesmo cálculo de datas do Contas a Pagar)
function aplicarPeriodoCaixa(periodo) {
    let intervalo = cpIntervaloPeriodo(periodo);
    document.getElementById("caixaDataInicio").value = intervalo ? intervalo[0] : "";
    document.getElementById("caixaDataFim").value = intervalo ? intervalo[1] : "";
    marcarChipsCaixa(periodo);
    mostrarFluxoCaixa();
}

function datasCaixaManuais() {
    marcarChipsCaixa(document.getElementById("caixaDataInicio").value || document.getElementById("caixaDataFim").value ? "personalizado" : "");
    mostrarFluxoCaixa();
}

function filtrarTipoCaixa(tipo) {
    filtroTipoCaixa = tipo;
    document.querySelectorAll("#telaFluxoCaixa .fcChipsTipo .ltChip").forEach(b => b.classList.toggle("ltChipAtivo", b.dataset.tipo === tipo));
    mostrarFluxoCaixa();
}

// todos os movimentos (histórico inteiro) com o saldo acumulado de cada um --
// usado pela tela e pelo extrato impresso, então os dois nunca divergem
function montarMovimentosCaixa() {
    let movimentos = [];
    if (saldoInicialCache.valor) {
        let dataISO = extrairDataISO(saldoInicialCache.data);
        if (dataISO) {
            movimentos.push({
                dataISO, data: saldoInicialCache.data, tipo: "entrada",
                origem: "Saldo Inicial", categoria: "Saldo inicial",
                descricao: "Saldo inicial de caixa (editável em Definir Saldo Inicial, no Dashboard)",
                valor: saldoInicialCache.valor
            });
        }
    }
    relatorios.forEach(r => {
        let dataISO = extrairDataISO(r.data);
        if (!dataISO) return;
        let d = calcularDadosCompletos(r);
        let tipo = (r.tipo || "venda") === "compra" ? "saida" : "entrada";
        movimentos.push({
            dataISO, data: r.data, tipo,
            origem: "Pesagem" + (r.numero ? " Nº " + r.numero : "") + (tipo === "saida" ? " (compra)" : " (venda)"),
            categoria: tipo === "saida" ? "Compra de gado" : "Venda de gado",
            descricao: (r.vendedor || "Não informado") + (r.descricao && r.descricao !== "Sem descrição" ? " — " + r.descricao : ""),
            valor: d.totalRS
        });
    });
    // Entrada de estoque não aparece aqui de propósito: ela é só a chegada
    // física do produto, não uma saída de dinheiro (a compra pode ter sido
    // parcelada). O gasto real vira caixa quando é de fato pago.
    caixaLancamentosCacheAdmin.forEach(l => {
        let dataISO = extrairDataISO(l.data);
        if (!dataISO) return;
        movimentos.push({
            dataISO, data: l.data, tipo: l.tipo,
            origem: l.categoria || "Lançamento manual",
            categoria: l.categoria && l.categoria.trim() ? l.categoria : "Sem categoria",
            descricao: l.descricao || l.categoria || "—",
            lote: l.loteNome || "", subCaixa: l.subCaixaNome || "",
            valor: l.valor,
            id: l.id, excluivel: true
        });
    });
    // ordem pela data E hora (antes era só o dia -- lançamentos do mesmo dia
    // ficavam fora de ordem no saldo acumulado)
    movimentos.forEach(m => { m.chave = chaveOrdenacaoLote(m.data) || m.dataISO; });
    movimentos.sort((a, b) => (a.chave < b.chave ? -1 : (a.chave > b.chave ? 1 : 0)));
    let saldoCorrente = 0;
    movimentos.forEach(m => {
        saldoCorrente += (m.tipo === "entrada" ? m.valor : -m.valor);
        m.saldoAcumulado = saldoCorrente;
    });
    return movimentos;
}

// o que está filtrado na tela (período + tipo + busca)
function filtrarMovimentosCaixa(movimentos) {
    let de = document.getElementById("caixaDataInicio").value;
    let ate = document.getElementById("caixaDataFim").value;
    let busca = (document.getElementById("caixaBusca")?.value || "").trim().toLowerCase();
    let noPeriodo = movimentos.filter(m => (!de || m.dataISO >= de) && (!ate || m.dataISO <= ate));
    let anteriores = de ? movimentos.filter(m => m.dataISO < de) : [];
    let saldoAnterior = anteriores.length ? anteriores[anteriores.length - 1].saldoAcumulado : 0;
    let categoriaFiltro = document.getElementById("caixaFiltroCategoria")?.value || "";
    let visiveis = noPeriodo.filter(m => (!filtroTipoCaixa || m.tipo === filtroTipoCaixa) && (!categoriaFiltro || m.categoria === categoriaFiltro) &&
        (!busca || [m.descricao, m.origem, m.lote, m.subCaixa, formatarMoeda(m.valor)].some(t => String(t || "").toLowerCase().includes(busca))));
    return { de, ate, busca, noPeriodo, visiveis, saldoAnterior, categoriaFiltro };
}

function desenharSparklineCaixa(movimentos) {
    let el = document.getElementById("fcSparkline");
    if (!el) return;
    let hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let pontos = [];
    let i = 0, saldo = 0;
    for (let d = 29; d >= 0; d--) {
        let dia = new Date(hoje); dia.setDate(dia.getDate() - d);
        let iso = cpDataLocalISO(dia);
        while (i < movimentos.length && movimentos[i].dataISO <= iso) { saldo = movimentos[i].saldoAcumulado; i++; }
        pontos.push(saldo);
    }
    let min = Math.min(...pontos), max = Math.max(...pontos);
    let faixa = max - min || 1;
    let xy = pontos.map((v, k) => [k / 29 * 300, 72 - (v - min) / faixa * 62]);
    let linha = xy.map(([x, y], k) => (k ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
    el.innerHTML = `<defs><linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34d399" stop-opacity="0.35"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></linearGradient></defs>
        <path d="${linha} L300 80 L0 80 Z" fill="url(#fcGrad)"/><path d="${linha}" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    let variacao = pontos[29] - pontos[0];
    let elVar = document.getElementById("fcVariacao30");
    if (elVar) {
        elVar.innerText = (variacao >= 0 ? "+ " : "− ") + "R$ " + formatarMoeda(Math.abs(variacao));
        elVar.className = variacao >= 0 ? "fcEntrada" : "fcSaida";
    }
}

function mostrarFluxoCaixa() {
    let corpo = document.getElementById("corpoTabelaFluxoCaixa");
    if (!corpo) return;
    let esc = escaparHtmlPesagem;
    let I = ICONES_CAIXA;
    let movimentos = montarMovimentosCaixa();
    let saldoAtual = movimentos.length ? movimentos[movimentos.length - 1].saldoAcumulado : 0;

    // saldo de verdade, com TODO o histórico — não se mexe com o filtro de
    // período, senão passa a impressão errada de que o dinheiro "sumiu"
    let elSaldoAtual = document.getElementById("caixaSaldoAtual");
    if (elSaldoAtual) {
        elSaldoAtual.innerText = (saldoAtual < 0 ? "− " : "") + "R$ " + formatarMoeda(Math.abs(saldoAtual));
        elSaldoAtual.classList.toggle("fcNegativo", saldoAtual < 0);
    }
    // este mês + último lançamento + gráfico
    let [inicioMes, fimMes] = cpIntervaloPeriodo("mes");
    let doMes = movimentos.filter(m => m.dataISO >= inicioMes && m.dataISO <= fimMes);
    let set = (id, v) => { let el = document.getElementById(id); if (el) el.innerText = v; };
    set("fcMesTitulo", "Este mês · " + new Date().toLocaleDateString("pt-BR", { month: "long" }));
    set("fcMesEntradas", "R$ " + formatarMoeda(doMes.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0)));
    set("fcMesSaidas", "R$ " + formatarMoeda(doMes.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0)));
    set("fcUltimoLancamento", movimentos.length ? String(movimentos[movimentos.length - 1].data).split(",")[0] : "—");
    desenharSparklineCaixa(movimentos);

    // filtro de categoria: as que aparecem nos lançamentos (mantém a escolha)
    let selCat = document.getElementById("caixaFiltroCategoria");
    if (selCat) {
        let atual = selCat.value;
        let nomes = [...new Set(movimentos.map(m => m.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        selCat.innerHTML = `<option value="">Categoria: Todas</option>` + nomes.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
        selCat.value = nomes.includes(atual) ? atual : "";
        selCat.classList.toggle("ltFiltroUsado", !!selCat.value);
    }
    let { de, visiveis, noPeriodo, saldoAnterior } = filtrarMovimentosCaixa(movimentos);
    desenharGastosPorCategoria(noPeriodo);
    let totalEntradas = visiveis.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
    let totalSaidas = visiveis.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
    set("fcSaldoAnterior", de ? (saldoAnterior < 0 ? "− " : "") + "R$ " + formatarMoeda(Math.abs(saldoAnterior)) : "—");
    set("caixaTotalEntradas", "R$ " + formatarMoeda(totalEntradas));
    set("caixaTotalSaidas", "R$ " + formatarMoeda(totalSaidas));
    let saldoEl = document.getElementById("caixaSaldoPeriodo");
    let saldoPeriodo = totalEntradas - totalSaidas;
    saldoEl.innerText = (saldoPeriodo >= 0 ? "+ R$ " : "− R$ ") + formatarMoeda(Math.abs(saldoPeriodo));
    saldoEl.style.color = saldoPeriodo >= 0 ? "#3ddc84" : "#ff7b72";
    set("fcResumoExtrato", `${visiveis.length} ${visiveis.length === 1 ? "lançamento" : "lançamentos"}${visiveis.length !== noPeriodo.length ? " (filtrado)" : ""}`);

    if (visiveis.length === 0) {
        corpo.innerHTML = `<p class="ltVazio fcVazio">Nenhuma movimentação nesse filtro.</p>`;
        return;
    }
    // mais recente primeiro, agrupado por dia (com o resultado do dia)
    let porDia = [];
    [...visiveis].reverse().forEach(m => {
        let ultimo = porDia[porDia.length - 1];
        if (!ultimo || ultimo.dataISO !== m.dataISO) porDia.push(ultimo = { dataISO: m.dataISO, itens: [], liquido: 0 });
        ultimo.itens.push(m);
        ultimo.liquido += m.tipo === "entrada" ? m.valor : -m.valor;
    });
    corpo.innerHTML = porDia.map(dia => {
        let data = new Date(dia.dataISO + "T12:00:00");
        let titulo = data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
        titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
        return `
        <div class="fcDia">
            <div class="fcDiaTopo"><span>${titulo}</span><b class="${dia.liquido >= 0 ? "fcEntrada" : "fcSaida"}">${dia.liquido >= 0 ? "+ " : "− "}R$ ${formatarMoeda(Math.abs(dia.liquido))}</b></div>
            ${dia.itens.map(m => {
                let entrada = m.tipo === "entrada";
                let hora = (String(m.data).split(",")[1] || "").trim().slice(0, 5);
                return `
                <div class="fcLinha ${entrada ? "fcLinhaEntrada" : "fcLinhaSaida"}">
                    <span class="fcIconeTipo">${entrada ? I.entrada : I.saida}</span>
                    <div class="fcTextos">
                        <b>${esc(m.descricao)}</b>
                        <small>${esc(m.origem)}${hora ? " · " + hora : ""}${m.lote ? ` · <span class="fcEtiqueta">${I.tag}${esc(m.lote)}</span>` : ""}${m.subCaixa ? ` · <span class="fcEtiqueta">${I.pasta}${esc(m.subCaixa)}</span>` : ""}</small>
                    </div>
                    <span class="fcValor">${entrada ? "+ " : "− "}R$ ${formatarMoeda(m.valor)}</span>
                    <span class="fcSaldoApos" data-rotulo="Saldo após">R$ ${formatarMoeda(m.saldoAcumulado)}</span>
                    <span class="fcAcao">${m.excluivel ? `<button class="ltBtnIcone ltBtnExcluir" onclick='excluirLancamento(${jsonAtributo(m.id)})' title="Excluir lançamento" aria-label="Excluir lançamento">${I.lixeira}</button>` : ""}</span>
                </div>`;
            }).join("")}
        </div>`;
    }).join("");
}

// saídas do período agrupadas por categoria (clicar filtra o extrato)
function desenharGastosPorCategoria(noPeriodo) {
    let el = document.getElementById("catGastos");
    if (!el) return;
    let esc = escaparHtmlPesagem;
    let de = document.getElementById("caixaDataInicio").value, ate = document.getElementById("caixaDataFim").value;
    let br = iso => iso.split("-").reverse().join("/");
    let periodo = document.getElementById("catPainelPeriodo");
    if (periodo) periodo.innerText = de || ate ? `${de ? br(de) : "início"} a ${ate ? br(ate) : "hoje"}` : "todo o histórico";
    let soma = {};
    noPeriodo.filter(m => m.tipo === "saida").forEach(m => { soma[m.categoria] = (soma[m.categoria] || 0) + m.valor; });
    let nomes = Object.keys(soma).sort((a, b) => soma[b] - soma[a]);
    let total = nomes.reduce((s, n) => s + soma[n], 0);
    if (!nomes.length) { el.innerHTML = `<p class="vmVazio">Nenhuma saída nesse período.</p>`; return; }
    let filtro = document.getElementById("caixaFiltroCategoria")?.value || "";
    el.innerHTML = `<div class="catGastosGrade">` + nomes.map(n => `
        <button class="catGasto${filtro === n ? " catGastoAtivo" : ""}${n === "Sem categoria" ? " catGastoSem" : ""}" onclick='filtrarCategoriaCaixa(${jsonAtributo(n)})' title="Ver só ${esc(n)} no extrato">
            <div class="catGastoTopo"><span>${esc(n)}</span><b>R$ ${formatarMoeda(soma[n])}</b></div>
            <div class="almBarra"><i style="width:${Math.max(2, soma[n] / total * 100)}%"></i></div>
            <small>${Math.round(soma[n] / total * 100)}% das saídas</small>
        </button>`).join("") + `</div>`;
}

function filtrarCategoriaCaixa(nome) {
    let sel = document.getElementById("caixaFiltroCategoria");
    if (!sel) return;
    sel.value = sel.value === nome ? "" : nome;
    mostrarFluxoCaixa();
    document.querySelector("#telaFluxoCaixa .fcExtrato")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// extrato impresso do período filtrado (mesma folha branca dos relatórios)
function imprimirExtratoCaixa() {
    let esc = escaparHtmlPesagem;
    let movimentos = montarMovimentosCaixa();
    let { de, ate, busca, noPeriodo, visiveis, saldoAnterior, categoriaFiltro } = filtrarMovimentosCaixa(movimentos);
    let br = iso => iso ? iso.split("-").reverse().join("/") : "";
    let periodo = de || ate ? `${de ? br(de) : "início"} a ${ate ? br(ate) : "hoje"}` : "Todo o histórico";
    let entradas = visiveis.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
    let saidas = visiveis.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
    let saldoFinal = noPeriodo.length ? noPeriodo[noPeriodo.length - 1].saldoAcumulado : saldoAnterior;
    let filtrado = visiveis.length !== noPeriodo.length;
    let rs = v => (v < 0 ? "− " : "") + "R$ " + formatarMoeda(Math.abs(v));
    let quadro = (rotulo, valor, destaque) => `<div class="folhaQuadro${destaque ? " folhaQuadroDestaque" : ""}"><span>${rotulo}</span><b>${valor}</b></div>`;

    let html = `
        <header class="folhaTopo">
            <div>
                <div class="folhaFazenda">${esc(nomeFazendaAtual())}</div>
                <h1>Extrato de Caixa</h1>
            </div>
            <div class="folhaTopoDireita">
                <span class="folhaSelo folhaSeloVenda">${esc(periodo.toUpperCase())}</span>
                <small>Emitido em ${new Date().toLocaleString("pt-BR")}</small>
            </div>
        </header>
        <section class="folhaDados">
            <div><span>Período</span><b>${esc(periodo)}</b></div>
            <div><span>Lançamentos</span><b>${visiveis.length}</b></div>
            <div><span>Filtro</span><b>${filtroTipoCaixa === "entrada" ? "Só entradas" : filtroTipoCaixa === "saida" ? "Só saídas" : "Entradas e saídas"}${categoriaFiltro ? ` · ${esc(categoriaFiltro)}` : ""}${busca ? ` · "${esc(busca)}"` : ""}</b></div>
            <div><span>Emitido por</span><b>${esc(obterUsuarioLogado() || "—")}</b></div>
        </section>
        <section class="folhaResumo">
            ${quadro("Saldo anterior", de ? rs(saldoAnterior) : "—")}
            ${quadro("Entradas", "R$ " + formatarMoeda(entradas))}
            ${quadro("Saídas", "R$ " + formatarMoeda(saidas))}
            ${quadro("Resultado", (entradas - saidas >= 0 ? "+ " : "− ") + "R$ " + formatarMoeda(Math.abs(entradas - saidas)))}
            ${quadro("Saldo no fim do período", rs(saldoFinal), true)}
        </section>
        ${filtrado ? `<p class="folhaAviso">Lista filtrada: a coluna Saldo considera todos os lançamentos do caixa, inclusive os que não aparecem aqui.</p>` : ""}
        <table class="folhaTabela folhaExtrato">
            <thead><tr><th>Data</th><th>Descrição</th><th>Origem</th><th>Entrada</th><th>Saída</th><th>Saldo</th></tr></thead>
            <tbody>
                ${de ? `<tr class="folhaLinhaSaldo"><td>${br(de)}</td><td class="folhaObs">Saldo anterior</td><td></td><td></td><td></td><td>${rs(saldoAnterior)}</td></tr>` : ""}
                ${visiveis.map(m => `<tr>
                    <td>${esc(String(m.data).split(",")[0])}</td>
                    <td class="folhaObs">${esc(m.descricao)}${m.lote ? ` <small>(lote ${esc(m.lote)})</small>` : ""}</td>
                    <td class="folhaObs">${esc(m.origem)}</td>
                    <td>${m.tipo === "entrada" ? "R$ " + formatarMoeda(m.valor) : ""}</td>
                    <td>${m.tipo === "saida" ? "R$ " + formatarMoeda(m.valor) : ""}</td>
                    <td>${rs(m.saldoAcumulado)}</td>
                </tr>`).join("")}
            </tbody>
            <tfoot><tr><td colspan="3">Totais do período</td><td>R$ ${formatarMoeda(entradas)}</td><td>R$ ${formatarMoeda(saidas)}</td><td>${rs(saldoFinal)}</td></tr></tfoot>
        </table>
        ${visiveis.length === 0 ? `<p class="folhaAviso">Nenhuma movimentação nesse período.</p>` : ""}
        <footer class="folhaRodape">
            <div class="folhaAssinaturas">
                <div><span></span>Responsável</div>
                <div><span></span>${esc(nomeFazendaAtual())}</div>
            </div>
            <small>Extrato gerado pelo PesoCerto</small>
        </footer>`;

    document.getElementById("folhaRelatorio").innerHTML = html;
    document.getElementById("telaImpressao").classList.add("modoExtrato");
    let titulo = document.getElementById("impressaoTitulo");
    if (titulo) titulo.innerText = "Extrato de caixa · " + periodo;
    let voltar = document.getElementById("impressaoVoltarTexto");
    if (voltar) voltar.innerText = "Voltar ao Fluxo de Caixa";
    trocarTela("telaImpressao");
    window.scrollTo(0, 0);
}

async function abrirModalLancamento() {
    document.getElementById("lancamentoTipoInput").value = "saida";
    await carregarCategoriasFinanceiras();
    document.getElementById("lancamentoCategoriaInput").value = "";
    preencherCategoriasLancamento();
    document.getElementById("lancamentoDescricaoInput").value = "";
    document.getElementById("lancamentoValorInput").value = "";
    document.getElementById("lancamentoDataInput").value = new Date().toISOString().slice(0, 10);

    let token = obterToken();
    let selectLote = document.getElementById("lancamentoLoteInput");
    if (token && selectLote) {
        let lotes = await fetch(`${API_URL}/api/lotes`, { headers: { "Authorization": "Bearer " + token } }).then(r => r.ok ? r.json() : []);
        selectLote.innerHTML = `<option value="">Sem lote específico</option>` +
            lotes.filter(l => l.ativo).map(l => `<option value="${l.nome.replace(/"/g, "&quot;")}">${l.nome}</option>`).join("");
    }
    let selectSubCaixa = document.getElementById("lancamentoSubCaixaInput");
    if (token && selectSubCaixa) {
        await carregarSubCaixasAdmin();
        selectSubCaixa.innerHTML = `<option value="">Caixa Geral (sem sub-caixa)</option>` +
            subCaixasCacheAdmin.filter(s => s.ativo).map(s => `<option value="${s.nome.replace(/"/g, "&quot;")}">${s.nome}</option>`).join("");
    }

    let erroEl = document.getElementById("lancamentoErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    novaChaveIdempotencia("modalLancamento");
    document.getElementById("modalLancamento").style.display = "flex";
}

function fecharModalLancamento() {
    document.getElementById("modalLancamento").style.display = "none";
}

async function salvarLancamento() {
    let erroEl = document.getElementById("lancamentoErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let tipo = document.getElementById("lancamentoTipoInput").value;
        let categoria = document.getElementById("lancamentoCategoriaInput").value;
        if (!categoria) { mostrarErro("Escolha a categoria."); return; }
        let loteNome = document.getElementById("lancamentoLoteInput").value;
        let subCaixaNome = document.getElementById("lancamentoSubCaixaInput").value;
        let descricao = document.getElementById("lancamentoDescricaoInput").value.trim();
        let valorTexto = document.getElementById("lancamentoValorInput").value.trim();
        let valor = parseFloat(valorTexto.replace(/\./g, "").replace(",", "."));
        let dataInput = document.getElementById("lancamentoDataInput").value;

        if (!Number.isFinite(valor) || valor <= 0) { mostrarErro("Informe um valor válido."); return; }

        let dataFormatada = dataInput ? formatarDataBR(dataInput) : new Date().toLocaleString("pt-BR");

        let resp = await fetch(`${API_URL}/api/caixa-lancamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ id: obterChaveIdempotencia("modalLancamento"), tipo, categoria: categoria || null, descricao: descricao || null, valor, data: dataFormatada, loteNome: loteNome || null, subCaixaNome: subCaixaNome || null })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar lançamento (HTTP ${resp.status}).`); return; }

        fecharModalLancamento();
        await carregarCaixaLancamentosAdmin();
        mostrarFluxoCaixa();
        if (typeof mostrarSubCaixas === "function") mostrarSubCaixas();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function excluirLancamento(id) {
    if (!await confirmarModerno("Excluir este lançamento?")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/caixa-lancamentos/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir lançamento (HTTP ${resp.status}).`); return; }
        await carregarCaixaLancamentosAdmin();
        mostrarFluxoCaixa();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

async function excluirEntradaEstoque(id, produtoDescricao) {
    if (!await confirmarModerno(`Excluir esta entrada de "${produtoDescricao}"? Só é possível se esse estoque ainda não tiver sido consumido em nenhuma saída.`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/estoque-entradas/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir entrada (HTTP ${resp.status}).`); return; }
        await carregarEstoque();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ========================================
// CONTAS A PAGAR
// ========================================
// É uma agenda POR CIMA do caixa_lancamentos, não uma fonte de dinheiro
// paralela: uma parcela só vira movimentação real quando marcada como paga
// (o servidor cria o caixa_lancamentos na hora) — por isso Fluxo de Caixa,
// Resultado Mensal, Patrimônio e Custo por Lote já enxergam automaticamente,
// sem precisar de nenhum código novo nesses relatórios.
let contasPagarCacheAdmin = [];
let parcelaEmPagamentoId = null;
const CP_DIAS_VENCENDO_EM_BREVE = 7;

async function carregarContasPagarAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/contas-pagar`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        contasPagarCacheAdmin = await resp.json();
        return contasPagarCacheAdmin;
    } catch (e) {
        return [];
    }
}

// status é sempre calculado no cliente comparando com hoje — só "paga" é um
// fato gravado no banco; "vencendo"/"vencida" mudam sozinhas com o tempo,
// não fazem sentido como algo fixo salvo na parcela.
// data de hoje no fuso do aparelho (toISOString é UTC: depois das 21h no
// Brasil já viraria "amanhã" e a parcela de hoje apareceria vencida)
function cpDataLocalISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function statusParcela(parcela) {
    if (parcela.paga) return { chave: "paga", texto: "✅ Paga", cor: "#3ddc84" };
    let hojeISO = cpDataLocalISO(new Date());
    let vencISO = extrairDataISO(parcela.dataVencimento);
    if (!vencISO) return { chave: "pendente", texto: "Pendente", cor: "#c3cbdc" };
    if (vencISO < hojeISO) return { chave: "vencida", texto: "🔴 Vencida", cor: "#ff7b72" };
    let limite = new Date();
    limite.setDate(limite.getDate() + CP_DIAS_VENCENDO_EM_BREVE);
    let limiteISO = cpDataLocalISO(limite);
    if (vencISO <= limiteISO) return { chave: "vencendo", texto: "⏰ Vence em breve", cor: "#ffc94d" };
    return { chave: "pendente", texto: "Pendente", cor: "#c3cbdc" };
}

async function abrirTelaContasPagar() {
    await carregarContasPagarAdmin();
    mostrarContasPagar();
}

// ---------- filtros da tela ----------
function cpIntervaloPeriodo(periodo) {
    let hoje = new Date(), ano = hoje.getFullYear(), mes = hoje.getMonth();
    let iso = cpDataLocalISO;
    let somarDias = n => { let d = new Date(hoje); d.setDate(d.getDate() + n); return d; };
    switch (periodo) {
        case "hoje": return [iso(hoje), iso(hoje)];
        case "prox7": return [iso(hoje), iso(somarDias(CP_DIAS_VENCENDO_EM_BREVE))];
        case "ult30": return [iso(somarDias(-30)), iso(hoje)];
        case "mes": return [iso(new Date(ano, mes, 1)), iso(new Date(ano, mes + 1, 0))];
        case "proxMes": return [iso(new Date(ano, mes + 1, 1)), iso(new Date(ano, mes + 2, 0))];
        case "mesPassado": return [iso(new Date(ano, mes - 1, 1)), iso(new Date(ano, mes, 0))];
        case "ano": return [`${ano}-01-01`, `${ano}-12-31`];
    }
    return null;
}

function cpAplicarPeriodo() {
    let periodo = document.getElementById("cpFiltroPeriodo").value;
    let de = document.getElementById("cpFiltroDe"), ate = document.getElementById("cpFiltroAte");
    let intervalo = cpIntervaloPeriodo(periodo);
    if (intervalo) { de.value = intervalo[0]; ate.value = intervalo[1]; }
    else if (periodo === "") { de.value = ""; ate.value = ""; }
    mostrarContasPagar();
}

// mexeu nas datas na mão -> período vira "Personalizado"
function cpDatasManuais() {
    let de = document.getElementById("cpFiltroDe").value, ate = document.getElementById("cpFiltroAte").value;
    document.getElementById("cpFiltroPeriodo").value = (de || ate) ? "personalizado" : "";
    mostrarContasPagar();
}

function cpLimparFiltros() {
    ["cpBusca", "cpFiltroStatus", "cpFiltroPeriodo", "cpFiltroDe", "cpFiltroAte", "cpFiltroCategoria", "cpFiltroLote", "cpFiltroSubCaixa"]
        .forEach(id => { let el = document.getElementById(id); if (el) el.value = ""; });
    document.getElementById("cpFiltroCampoData").value = "vencimento";
    mostrarContasPagar();
}

// clicar num indicador filtra por ele; clicar de novo no mesmo desfaz
function cpFiltrarPorIndicador(chave) {
    let status = document.getElementById("cpFiltroStatus");
    let periodo = document.getElementById("cpFiltroPeriodo");
    let campo = document.getElementById("cpFiltroCampoData");
    let jaAtivo = cpIndicadorAtivo() === chave;
    cpLimparFiltros();
    if (!jaAtivo) {
        if (chave === "pagasMes") {
            status.value = "paga"; campo.value = "pagamento"; periodo.value = "mes";
            cpAplicarPeriodo();
            return;
        }
        status.value = chave;
    }
    mostrarContasPagar();
}

function cpIndicadorAtivo() {
    let status = document.getElementById("cpFiltroStatus").value;
    let periodo = document.getElementById("cpFiltroPeriodo").value;
    let campo = document.getElementById("cpFiltroCampoData").value;
    if (status === "paga" && periodo === "mes" && campo === "pagamento") return "pagasMes";
    if (["aPagar", "vencida", "vencendo"].includes(status) && !periodo) return status;
    return "";
}

// preenche lote/sub-caixa com o que existe nas contas, sem perder a escolha atual
function cpPreencherOpcoes(id, rotuloTodos, valores) {
    let sel = document.getElementById(id);
    if (!sel) return;
    let atual = sel.value;
    let lista = [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    sel.innerHTML = `<option value="">${rotuloTodos}</option>` +
        `<option value="__nenhum">(sem nenhum)</option>` +
        lista.map(v => `<option value="${escaparHtmlPesagem(v)}">${escaparHtmlPesagem(v)}</option>`).join("");
    sel.value = (atual === "__nenhum" || lista.includes(atual)) ? atual : "";
}

function mostrarContasPagar() {
    let corpo = document.getElementById("corpoTabelaContasPagar");
    if (!corpo) return;

    // achata as parcelas de todas as contas numa lista só, ordenada pela
    // mais urgente primeiro — é uma agenda do que precisa ser feito, não um
    // extrato histórico (diferente do Fluxo de Caixa, que mostra o mais
    // recente primeiro).
    let linhas = [];
    contasPagarCacheAdmin.forEach(conta => {
        conta.parcelas.forEach(parcela => {
            linhas.push({ conta, parcela, status: statusParcela(parcela) });
        });
    });

    // indicadores: sempre do total (não mudam com o filtro)
    let [inicioMes, fimMes] = cpIntervaloPeriodo("mes");
    let soma = { aPagar: [0, 0], vencida: [0, 0], vencendo: [0, 0], pagasMes: [0, 0] };
    let somar = (chave, valor) => { soma[chave][0] += valor; soma[chave][1]++; };
    linhas.forEach(l => {
        if (l.status.chave === "paga") {
            let pagoEm = extrairDataISO(l.parcela.dataPagamento);
            if (pagoEm && pagoEm >= inicioMes && pagoEm <= fimMes) somar("pagasMes", l.parcela.valor);
            return;
        }
        somar("aPagar", l.parcela.valor);
        if (l.status.chave === "vencendo") somar("vencendo", l.parcela.valor);
        if (l.status.chave === "vencida") somar("vencida", l.parcela.valor);
    });
    let qtdTexto = n => n === 0 ? "nenhuma parcela" : (n === 1 ? "1 parcela" : n + " parcelas");
    [["aPagar", "cpTotalPendente", "cpQtdPendente"], ["vencida", "cpVencidas", "cpQtdVencidas"],
     ["vencendo", "cpVencendoBreve", "cpQtdVencendo"], ["pagasMes", "cpPagasMes", "cpQtdPagasMes"]].forEach(([chave, idValor, idQtd]) => {
        let elValor = document.getElementById(idValor), elQtd = document.getElementById(idQtd);
        if (elValor) elValor.innerText = "R$ " + formatarMoeda(soma[chave][0]);
        if (elQtd) elQtd.innerText = qtdTexto(soma[chave][1]);
    });

    cpPreencherOpcoes("cpFiltroCategoria", "Categoria: Todas", contasPagarCacheAdmin.map(c => c.categoria));
    cpPreencherOpcoes("cpFiltroLote", "Lote: Todos", contasPagarCacheAdmin.map(c => c.loteNome));
    cpPreencherOpcoes("cpFiltroSubCaixa", "Sub-caixa: Todas", contasPagarCacheAdmin.map(c => c.subCaixaNome));

    let valor = id => { let el = document.getElementById(id); return el ? el.value : ""; };
    let statusFiltro = valor("cpFiltroStatus");
    let campoData = valor("cpFiltroCampoData") || "vencimento";
    let de = valor("cpFiltroDe"), ate = valor("cpFiltroAte");
    let loteFiltro = valor("cpFiltroLote"), subCaixaFiltro = valor("cpFiltroSubCaixa"), categoriaFiltro = valor("cpFiltroCategoria");
    let busca = valor("cpBusca").trim().toLowerCase();
    let dataDaLinha = l => extrairDataISO(campoData === "compra" ? l.conta.dataCompra
        : campoData === "pagamento" ? l.parcela.dataPagamento : l.parcela.dataVencimento) || "";

    if (statusFiltro === "aPagar") linhas = linhas.filter(l => l.status.chave !== "paga");
    else if (statusFiltro) linhas = linhas.filter(l => l.status.chave === statusFiltro);
    if (de || ate) linhas = linhas.filter(l => {
        let d = dataDaLinha(l);
        return d && (!de || d >= de) && (!ate || d <= ate);
    });
    let confere = (filtro, campo) => !filtro || (filtro === "__nenhum" ? !campo : campo === filtro);
    linhas = linhas.filter(l => confere(loteFiltro, l.conta.loteNome) && confere(subCaixaFiltro, l.conta.subCaixaNome) && confere(categoriaFiltro, l.conta.categoria));
    if (busca) linhas = linhas.filter(l => [l.conta.descricao, l.conta.categoria, l.conta.loteNome, l.conta.subCaixaNome,
        formatarMoeda(l.parcela.valor)].some(t => String(t || "").toLowerCase().includes(busca)));

    // agenda: vencimento mais urgente primeiro; olhando por lançamento ou
    // pagamento, o mais recente primeiro (como um extrato)
    let crescente = campoData === "vencimento";
    linhas.sort((a, b) => {
        let da = dataDaLinha(a), db = dataDaLinha(b);
        let r = da < db ? -1 : (da > db ? 1 : 0);
        return crescente ? r : -r;
    });

    // indicador ativo + resumo do que está na tela
    let ativo = cpIndicadorAtivo();
    document.querySelectorAll(".cpKpi").forEach(b => b.classList.toggle("cpKpiAtivo", b.dataset.filtro === ativo));
    let algumFiltro = statusFiltro || de || ate || loteFiltro || subCaixaFiltro || categoriaFiltro || busca;
    let topo = document.querySelector(".cpTopo");
    if (topo) {
        topo.classList.toggle("cpComFiltro", !!algumFiltro);
        topo.classList.toggle("cpComPeriodo", !!(valor("cpFiltroPeriodo") || de || ate));
    }
    ["cpFiltroStatus", "cpFiltroPeriodo", "cpFiltroCategoria", "cpFiltroLote", "cpFiltroSubCaixa"].forEach(id => {
        let el = document.getElementById(id); if (el) el.classList.toggle("cpFiltroUsado", !!el.value);
    });
    let campo = document.getElementById("cpFiltroCampoData");
    if (campo) campo.classList.toggle("cpFiltroUsado", campo.value !== "vencimento");
    let resumo = document.getElementById("cpResumoFiltro");
    if (resumo) {
        let total = linhas.reduce((t, l) => t + l.parcela.valor, 0);
        resumo.innerHTML = `${algumFiltro ? "Filtrado: " : ""}<b>${qtdTexto(linhas.length)}</b> · <b>R$ ${formatarMoeda(total)}</b>`;
    }

    if (linhas.length === 0) {
        corpo.innerHTML = `<tr><td colspan="9">${algumFiltro ? "Nenhuma conta com esses filtros." : "Nenhuma conta encontrada."}</td></tr>`;
        return;
    }

    corpo.innerHTML = linhas.map(l => {
        let acoes = l.status.chave === "paga"
            ? `<button onclick='estornarPagamentoParcela(${jsonAtributo(l.parcela.id)})'>↩️ Estornar</button>`
            : `<button onclick='abrirModalPagarParcela(${jsonAtributo(l.parcela.id)})'>💰 Pagar</button>`;
        if (l.status.chave !== "paga") {
            acoes += `<button onclick='abrirModalEditarParcela(${jsonAtributo(l.parcela.id)})'>✏️</button>`;
        }
        if (l.parcela.numero === 1) {
            acoes += `<button onclick='excluirContaPagar(${jsonAtributo(l.conta.id)}, ${jsonAtributo(l.conta.descricao)})'>🗑️</button>`;
        }
        return `
            <tr>
                <td>${l.conta.dataCompra ? l.conta.dataCompra.split(",")[0] : "—"}</td>
                <td>${l.parcela.dataVencimento ? l.parcela.dataVencimento.split(",")[0] : "—"}</td>
                <td>${escaparHtmlPesagem(l.conta.descricao)}${l.conta.categoria ? `<small class="cpCategoria">${escaparHtmlPesagem(l.conta.categoria)}</small>` : ""}</td>
                <td>${l.parcela.numero}/${l.conta.numeroParcelas}</td>
                <td>R$ ${formatarMoeda(l.parcela.valor)}</td>
                <td style="color:${l.status.cor}">${l.status.texto}${l.parcela.paga && (l.parcela.formaPagamento || l.parcela.juros || l.parcela.desconto) ? `<small class="cpDetalhePagamento">${[l.parcela.formaPagamento ? escaparHtmlPesagem(l.parcela.formaPagamento) : "", l.parcela.juros ? "juros R$ " + formatarMoeda(l.parcela.juros) : "", l.parcela.desconto ? "desconto R$ " + formatarMoeda(l.parcela.desconto) : ""].filter(Boolean).join(" · ")}</small>` : ""}</td>
                <td>${l.conta.loteNome ? escaparHtmlPesagem(l.conta.loteNome) : "—"}</td>
                <td>${l.conta.subCaixaNome ? escaparHtmlPesagem(l.conta.subCaixaNome) : "—"}</td>
                <td class="acoesUsuario">${acoes}</td>
            </tr>
        `;
    }).join("");
}

async function abrirModalContaPagar() {
    let token = obterToken();
    if (!token) return;

    let lotes = await fetch(`${API_URL}/api/lotes`, { headers: { "Authorization": "Bearer " + token } }).then(r => r.ok ? r.json() : []);
    document.getElementById("cpLoteInput").innerHTML = `<option value="">Sem lote específico</option>` +
        lotes.filter(l => l.ativo).map(l => `<option value="${l.nome.replace(/"/g, "&quot;")}">${l.nome}</option>`).join("");

    await carregarSubCaixasAdmin();
    document.getElementById("cpSubCaixaInput").innerHTML = `<option value="">Caixa Geral (sem sub-caixa)</option>` +
        subCaixasCacheAdmin.filter(s => s.ativo).map(s => `<option value="${s.nome.replace(/"/g, "&quot;")}">${s.nome}</option>`).join("");

    document.getElementById("cpDescricaoInput").value = "";
    await carregarCategoriasFinanceiras();
    preencherSelectCategoria(document.getElementById("cpCategoriaInput"), "saida", "");
    document.getElementById("cpDataCompraInput").value = new Date().toISOString().slice(0, 10);
    document.getElementById("cpValorTotalInput").value = "";
    document.getElementById("cpNumeroParcelasInput").value = "1";
    document.getElementById("cpPrimeiroVencimentoInput").value = new Date().toISOString().slice(0, 10);
    let erroEl = document.getElementById("cpErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    novaChaveIdempotencia("modalContaPagar");
    atualizarPreviewContaPagar();
    document.getElementById("modalContaPagar").style.display = "flex";
}

function fecharModalContaPagar() {
    document.getElementById("modalContaPagar").style.display = "none";
}

// divide o valor total igualmente entre as parcelas, ajustando só a ÚLTIMA
// pra absorver a sobra de centavo do arredondamento (garante que a soma bata
// exatamente com o total, nunca fica R$0,01 faltando ou sobrando). Vencimento
// mensal a partir da primeira data informada — o construtor Date do JS já
// rola o mês/ano sozinho quando passa de dezembro.
function calcularParcelasContaPagar(valorTotal, numeroParcelas, primeiraDataISO) {
    let parcelas = [];
    let valorBase = Math.floor((valorTotal / numeroParcelas) * 100) / 100;
    let somaAteAgora = 0;
    let [ano, mes, dia] = primeiraDataISO.split("-").map(Number);
    for (let i = 1; i <= numeroParcelas; i++) {
        let valor = i === numeroParcelas ? Math.round((valorTotal - somaAteAgora) * 100) / 100 : valorBase;
        somaAteAgora += valor;
        // new Date(ano, mesAlvo, dia) NÃO trava no último dia do mês -- ele
        // rola pro mês seguinte quando "dia" não existe ali (ex: dia 31 não
        // existe em fevereiro), o que duplicava vencimentos no mesmo mês e
        // pulava outros inteiros. Trava manualmente no último dia válido.
        let mesesAFrente = mes - 1 + (i - 1);
        let anoAlvo = ano + Math.floor(mesesAFrente / 12);
        let mesAlvo = ((mesesAFrente % 12) + 12) % 12;
        let ultimoDiaDoMesAlvo = new Date(anoAlvo, mesAlvo + 1, 0).getDate();
        let diaAjustado = Math.min(dia, ultimoDiaDoMesAlvo);
        let isoParcela = `${anoAlvo}-${String(mesAlvo + 1).padStart(2, "0")}-${String(diaAjustado).padStart(2, "0")}`;
        parcelas.push({ numero: i, valor, dataVencimento: formatarDataBR(isoParcela) });
    }
    return parcelas;
}

function atualizarPreviewContaPagar() {
    let preview = document.getElementById("cpPreview");
    if (!preview) return;
    let valorTotal = lerValorBR(document.getElementById("cpValorTotalInput").value) || 0;
    let numeroParcelas = parseInt(document.getElementById("cpNumeroParcelasInput").value, 10) || 1;
    let primeiraData = document.getElementById("cpPrimeiroVencimentoInput").value;
    if (valorTotal <= 0 || numeroParcelas <= 0 || !primeiraData) { preview.innerText = ""; return; }
    let parcelas = calcularParcelasContaPagar(valorTotal, numeroParcelas, primeiraData);
    preview.innerText = parcelas.map(p => `${p.numero}ª: R$ ${formatarMoeda(p.valor)} (${p.dataVencimento.split(",")[0]})`).join(" · ");
}

async function salvarContaPagar() {
    let erroEl = document.getElementById("cpErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let descricao = document.getElementById("cpDescricaoInput").value.trim();
        let categoria = document.getElementById("cpCategoriaInput").value;
        if (!categoria) { mostrarErro("Escolha a categoria."); return; }
        let dataCompraISO = document.getElementById("cpDataCompraInput").value;
        let valorTotal = lerValorBR(document.getElementById("cpValorTotalInput").value);
        let numeroParcelas = parseInt(document.getElementById("cpNumeroParcelasInput").value, 10);
        let primeiraData = document.getElementById("cpPrimeiroVencimentoInput").value;
        let loteNome = document.getElementById("cpLoteInput").value;
        let subCaixaNome = document.getElementById("cpSubCaixaInput").value;

        if (!descricao) { mostrarErro("Informe a descrição."); return; }
        if (!Number.isFinite(valorTotal) || valorTotal <= 0) { mostrarErro("Informe um valor total válido."); return; }
        if (!Number.isInteger(numeroParcelas) || numeroParcelas <= 0) { mostrarErro("Número de parcelas inválido."); return; }
        if (!primeiraData) { mostrarErro("Informe a data do primeiro vencimento."); return; }

        let parcelas = calcularParcelasContaPagar(valorTotal, numeroParcelas, primeiraData);

        let dataCompra = dataCompraISO ? formatarDataBR(dataCompraISO) : null;
        let resp = await fetch(`${API_URL}/api/contas-pagar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ id: obterChaveIdempotencia("modalContaPagar"), descricao, categoria: categoria || null, dataCompra, valorTotal, loteNome: loteNome || null, subCaixaNome: subCaixaNome || null, parcelas })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar (HTTP ${resp.status}).`); return; }

        fecharModalContaPagar();
        await abrirTelaContasPagar();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function excluirContaPagar(id, descricao) {
    if (!await confirmarModerno(`Excluir a conta "${descricao}" e todas as suas parcelas?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/contas-pagar/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await abrirTelaContasPagar();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// pagamento: valor da parcela + juros − desconto, com a forma de pagamento
let parcelaEmPagamentoValor = 0;
let formaPagamentoEscolhida = "";

function mascaraMoedaPagamento(input) {
    let numero = Number(input.value.replace(/\D/g, "")) / 100;
    input.value = numero === 0 ? "" : "R$ " + formatarMoeda(numero);
    atualizarTotalPagamento();
}

function valoresPagamento() {
    let juros = lerValorBR(document.getElementById("ppJurosInput").value) || 0;
    let desconto = lerValorBR(document.getElementById("ppDescontoInput").value) || 0;
    let total = Math.round((parcelaEmPagamentoValor + juros - desconto) * 100) / 100;
    return { juros, desconto, total };
}

function atualizarTotalPagamento() {
    let { juros, desconto, total } = valoresPagamento();
    let el = document.getElementById("ppTotal");
    el.innerText = "R$ " + formatarMoeda(total);
    el.className = juros > desconto ? "ppMais" : desconto > juros ? "ppMenos" : "";
    document.getElementById("ppBotaoConfirmar").innerText = total > 0 ? "Pagar R$ " + formatarMoeda(total) : "Confirmar pagamento";
}

function escolherFormaPagamento(forma) {
    formaPagamentoEscolhida = forma;
    document.querySelectorAll("#ppFormas .ppForma").forEach(b => b.classList.toggle("ppFormaAtiva", b.dataset.forma === forma));
    let erroEl = document.getElementById("pagarParcelaErro");
    if (erroEl && forma) erroEl.style.display = "none";
}

function abrirModalPagarParcela(parcelaId) {
    parcelaEmPagamentoId = parcelaId;
    let achado = null;
    contasPagarCacheAdmin.forEach(conta => {
        conta.parcelas.forEach(parcela => {
            if (parcela.id === parcelaId) achado = { conta, parcela };
        });
    });
    if (!achado) return;

    let venc = achado.parcela.dataVencimento.split(",")[0];
    let vencISO = extrairDataISO(achado.parcela.dataVencimento);
    let diasAtraso = vencISO ? Math.floor((new Date(cpDataLocalISO(new Date()) + "T12:00:00") - new Date(vencISO + "T12:00:00")) / 86400000) : 0;
    document.getElementById("pagarParcelaInfo").innerHTML =
        `<b>${escaparHtmlPesagem(achado.conta.descricao)}</b> — parcela ${achado.parcela.numero}/${achado.conta.numeroParcelas} · vence ${venc}`
        + (diasAtraso > 0 ? ` <span class="ppAtraso">vencida há ${diasAtraso} ${diasAtraso === 1 ? "dia" : "dias"}</span>` : "");
    parcelaEmPagamentoValor = Number(achado.parcela.valor) || 0;
    document.getElementById("ppValorParcela").innerText = "R$ " + formatarMoeda(parcelaEmPagamentoValor);
    document.getElementById("ppJurosInput").value = "";
    document.getElementById("ppDescontoInput").value = "";
    escolherFormaPagamento("");
    atualizarTotalPagamento();
    document.getElementById("pagarParcelaDataInput").value = cpDataLocalISO(new Date());
    let erroEl = document.getElementById("pagarParcelaErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalPagarParcela").style.display = "flex";
}

function fecharModalPagarParcela() {
    document.getElementById("modalPagarParcela").style.display = "none";
    parcelaEmPagamentoId = null;
}

// pagar uma parcela cria um caixa_lancamentos de verdade no servidor — os
// relatórios financeiros do Dashboard (se estiverem carregados/visíveis)
// precisam ser atualizados também, senão ficam mostrando número desatualizado
// até a próxima navegação.
function atualizarRelatoriosFinanceirosAposMudanca() {
    if (typeof mostrarPatrimonio === "function") mostrarPatrimonio();
    if (typeof mostrarEvolucaoPatrimonio === "function") mostrarEvolucaoPatrimonio();
    if (typeof mostrarResultadoMensal === "function") mostrarResultadoMensal();
    if (typeof mostrarCustoPorLote === "function") mostrarCustoPorLote();
    if (typeof mostrarFolhaPagamento === "function") mostrarFolhaPagamento();
    if (typeof mostrarResumoSalarios === "function") mostrarResumoSalarios();
}

async function confirmarPagarParcela() {
    let erroEl = document.getElementById("pagarParcelaErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }
        if (!parcelaEmPagamentoId) return;

        let { juros, desconto, total } = valoresPagamento();
        let dataISO = document.getElementById("pagarParcelaDataInput").value;
        if (Number.isNaN(juros) || Number.isNaN(desconto)) { mostrarErro("Confira os valores de juros e desconto."); return; }
        if (!(total > 0)) { mostrarErro("O desconto não pode ser igual ou maior que o valor a pagar."); return; }
        if (!formaPagamentoEscolhida) { mostrarErro("Escolha a forma de pagamento."); return; }

        let dataFormatada = dataISO ? formatarDataBR(dataISO) : new Date().toLocaleString("pt-BR");
        let resp = await fetch(`${API_URL}/api/contas-pagar/parcelas/${parcelaEmPagamentoId}/pagar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ juros, desconto, formaPagamento: formaPagamentoEscolhida, data: dataFormatada })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao pagar (HTTP ${resp.status}).`); return; }

        fecharModalPagarParcela();
        await abrirTelaContasPagar();
        atualizarRelatoriosFinanceirosAposMudanca();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

let parcelaEmEdicaoId = null;

function abrirModalEditarParcela(parcelaId) {
    parcelaEmEdicaoId = parcelaId;
    let achado = null;
    contasPagarCacheAdmin.forEach(conta => {
        conta.parcelas.forEach(parcela => {
            if (parcela.id === parcelaId) achado = { conta, parcela };
        });
    });
    if (!achado) return;

    document.getElementById("editParcelaInfo").innerText =
        `${achado.conta.descricao} — parcela ${achado.parcela.numero}/${achado.conta.numeroParcelas}`;
    document.getElementById("editParcelaValorInput").value = String(achado.parcela.valor).replace(".", ",");
    document.getElementById("editParcelaDataInput").value = extrairDataISO(achado.parcela.dataVencimento) || "";
    let erroEl = document.getElementById("editParcelaErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalEditarParcela").style.display = "flex";
}

function fecharModalEditarParcela() {
    document.getElementById("modalEditarParcela").style.display = "none";
    parcelaEmEdicaoId = null;
}

async function confirmarEditarParcela() {
    let erroEl = document.getElementById("editParcelaErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }
    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }
        if (!parcelaEmEdicaoId) return;

        let valor = parseFloat(document.getElementById("editParcelaValorInput").value.replace(",", "."));
        let dataISO = document.getElementById("editParcelaDataInput").value;
        if (!Number.isFinite(valor) || valor <= 0) { mostrarErro("Informe um valor válido."); return; }
        if (!dataISO) { mostrarErro("Informe a data de vencimento."); return; }

        let resp = await fetch(`${API_URL}/api/contas-pagar/parcelas/${parcelaEmEdicaoId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ dataVencimento: formatarDataBR(dataISO), valor })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao alterar (HTTP ${resp.status}).`); return; }

        fecharModalEditarParcela();
        await abrirTelaContasPagar();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function estornarPagamentoParcela(parcelaId) {
    if (!await confirmarModerno("Estornar esse pagamento? O lançamento correspondente no Fluxo de Caixa será removido.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/contas-pagar/parcelas/${parcelaId}/estornar`, {
            method: "POST",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao estornar (HTTP ${resp.status}).`); return; }

        await abrirTelaContasPagar();
        atualizarRelatoriosFinanceirosAposMudanca();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ========================================
// ENERGIA
// ========================================
// Rateio do consumo próprio a partir da fatura do vizinho que fornece a
// energia. Cada lançamento vira uma Contas a Pagar de verdade na hora (1
// parcela) -- o valor só sai do caixa quando essa parcela é paga, pelo
// fluxo que já existe, sem criar nenhum caixa_lancamentos direto (senão
// duplica o mesmo bug de contagem dupla já corrigido no Almoxarifado).
let energiaCacheAdmin = [];

async function carregarEnergiaAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/energia`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        energiaCacheAdmin = await resp.json();
        return energiaCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function abrirTelaEnergia() {
    // contas a pagar: pra mostrar se a energia de cada mês já foi paga
    await Promise.all([carregarEnergiaAdmin(), carregarContasPagarAdmin()]);
    mostrarEnergia();
}

const ICONES_ENERGIA = {
    "raio": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><polygon points=\"13 2 3 14 12 14 11 22 21 10 12 10 13 2\"></polygon></svg>",
    "mais": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"></path></svg>",
    "medidor": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"13\" r=\"8\"></circle><path d=\"M12 13l3.5-3.5\"></path><path d=\"M8 5.5L7 4M16 5.5l1-1.5M12 3V2\"></path></svg>",
    "tomada": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 2v6M15 2v6\"></path><path d=\"M6 8h12v4a6 6 0 0 1-12 0z\"></path><path d=\"M12 18v4\"></path></svg>",
    "etiqueta": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z\"></path><circle cx=\"7\" cy=\"7\" r=\"1.3\" fill=\"currentColor\"></circle></svg>",
    "media": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 12h18\"></path><path d=\"M3 6h18\" opacity=\".4\"></path><path d=\"M3 18h18\" opacity=\".4\"></path></svg>",
    "calendario": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2\"></rect><path d=\"M16 2v4M8 2v4M3 10h18\"></path></svg>",
    "grafico": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 3v18h18\"></path><rect x=\"7\" y=\"12\" width=\"3\" height=\"6\"></rect><rect x=\"12\" y=\"8\" width=\"3\" height=\"10\"></rect><rect x=\"17\" y=\"5\" width=\"3\" height=\"13\"></rect></svg>",
    "casa": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"></path><polyline points=\"9 22 9 12 15 12 15 22\"></polyline></svg>",
    "lixeira": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 6h18\"></path><path d=\"M8 6V4h8v2\"></path><path d=\"M19 6l-1 14H6L5 6\"></path><path d=\"M10 11v6M14 11v6\"></path></svg>",
    "info": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M12 11v5\"></path><path d=\"M12 8h.01\"></path></svg>",
    "seta": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h14\"></path><path d=\"M13 6l6 6-6 6\"></path></svg>"
};

// situação da conta a pagar gerada por um lançamento de energia
function statusContaEnergia(e) {
    let conta = e.contaPagarId ? contasPagarCacheAdmin.find(c => c.id === e.contaPagarId) : null;
    let parcela = conta && conta.parcelas ? conta.parcelas[0] : null;
    if (!parcela) return { chave: "sem", texto: "Sem conta vinculada" };
    let st = statusParcela(parcela);
    let venc = parcela.dataVencimento ? parcela.dataVencimento.split(",")[0] : "";
    if (st.chave === "paga") return { chave: "paga", texto: "Pago" };
    if (st.chave === "vencida") return { chave: "vencida", texto: "Vencida em " + venc };
    return { chave: "pendente", texto: "A pagar · vence " + venc };
}

function mostrarEnergia() {
    let corpo = document.getElementById("corpoTabelaEnergia");
    if (!corpo) return;
    let esc = escaparHtmlPesagem;
    let I = ICONES_ENERGIA;
    let set = (id, v) => { let el = document.getElementById(id); if (el) el.innerText = v; };
    let rs = v => "R$ " + formatarMoeda(v);
    let kwh = v => formatarPeso(Math.round(v * 10) / 10) + " kWh";
    let lista = energiaCacheAdmin; // já vem do mais recente pro mais antigo
    let ultima = lista[0] || null, anterior = lista[1] || null;
    let mesDe = e => {
        let iso = extrairDataISO(e.data);
        if (!iso) return "";
        let [a, m] = iso.split("-");
        let t = new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        return t.charAt(0).toUpperCase() + t.slice(1);
    };

    set("enMesTitulo", ultima ? "Energia de " + mesDe(ultima) : "Nenhum lançamento ainda");
    set("enValorPagar", ultima ? rs(ultima.valorAPagar) : "R$ 0,00");
    let elStatus = document.getElementById("enStatus");
    if (elStatus) {
        let st = ultima ? statusContaEnergia(ultima) : null;
        elStatus.className = "enStatus" + (st ? " enStatus_" + st.chave : "");
        elStatus.innerText = st ? st.texto : "Clique em Novo lançamento quando chegar a fatura do vizinho";
    }
    set("energiaUltimaLeitura", ultima ? formatarPeso(ultima.leituraAtual) : "—");
    set("enLeituraAnterior", ultima ? `anterior: ${formatarPeso(ultima.leituraAnterior)} kWh` : "");
    set("energiaConsumoMes", ultima ? kwh(ultima.consumoMes) : "—");
    set("energiaValorKwh", ultima ? rs(ultima.valorPorKwh) : "—");
    let variacao = (id, atual, antes, ehDinheiro) => {
        let el = document.getElementById(id);
        if (!el) return;
        if (!anterior || !antes) { el.innerHTML = ""; return; }
        let dif = atual - antes, pct = dif / antes * 100;
        let subiu = dif > 0.0001, igual = Math.abs(pct) < 0.5;
        el.className = "enVariacao " + (igual ? "enIgual" : subiu ? "enSubiu" : "enDesceu");
        el.innerText = igual ? "igual ao mês anterior"
            : `${subiu ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}% (${subiu ? "+" : "−"}${ehDinheiro ? rs(Math.abs(dif)) : kwh(Math.abs(dif))}) vs ${ehDinheiro ? rs(antes) : kwh(antes)}`;
    };
    variacao("enVarConsumo", ultima ? ultima.consumoMes : 0, anterior ? anterior.consumoMes : 0, false);
    variacao("enVarKwh", ultima ? ultima.valorPorKwh : 0, anterior ? anterior.valorPorKwh : 0, true);

    let n = lista.length;
    set("enMediaConsumo", n ? kwh(lista.reduce((s, e) => s + e.consumoMes, 0) / n) : "—");
    set("enMediaValor", n ? rs(lista.reduce((s, e) => s + e.valorAPagar, 0) / n) : "—");
    let ano = new Date().getFullYear();
    let doAno = lista.filter(e => (extrairDataISO(e.data) || "").startsWith(ano + "-"));
    set("enAnoRotulo", `Gasto em ${ano} (${doAno.length} ${doAno.length === 1 ? "mês" : "meses"})`);
    set("enTotalAno", rs(doAno.reduce((s, e) => s + e.valorAPagar, 0)));
    set("enParteFatura", ultima && ultima.consumoTotalFatura > 0 ? Math.round(ultima.consumoMes / ultima.consumoTotalFatura * 100) + "%" : "—");
    set("enParteRotulo", ultima && ultima.consumoTotalFatura > 0 ? `Sua parte da fatura (${kwh(ultima.consumoMes)} de ${kwh(ultima.consumoTotalFatura)})` : "Sua parte da fatura do vizinho");

    // gráfico: últimos 12 lançamentos, do mais antigo pro mais novo
    let grafico = document.getElementById("enGrafico");
    if (grafico) {
        let pontos = lista.slice(0, 12).reverse();
        let max = Math.max(1, ...pontos.map(e => e.consumoMes));
        grafico.innerHTML = pontos.length === 0 ? `<p class="vmVazio">O gráfico aparece depois do primeiro lançamento.</p>` : pontos.map((e, i) => {
            let iso = extrairDataISO(e.data) || "";
            let [a, m] = iso.split("-");
            let rotulo = iso ? new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") + "/" + a.slice(2) : "—";
            return `
            <div class="enBarra${i === pontos.length - 1 ? " enBarraAtual" : ""}" title="${esc(rotulo)}: ${kwh(e.consumoMes)} · ${rs(e.valorAPagar)}">
                <span class="enBarraKwh">${formatarPeso(Math.round(e.consumoMes))}</span>
                <div class="enBarraColuna"><i style="height:${Math.max(3, e.consumoMes / max * 100)}%"></i></div>
                <span class="enBarraValor">${rs(e.valorAPagar)}</span>
                <small>${esc(rotulo)}</small>
            </div>`;
        }).join("");
    }

    set("enQtd", `${n} ${n === 1 ? "lançamento" : "lançamentos"}`);
    if (n === 0) {
        corpo.innerHTML = `<p class="ltVazio fcVazio">Nenhum lançamento registrado ainda.</p>`;
        return;
    }
    corpo.innerHTML = lista.map(e => {
        let st = statusContaEnergia(e);
        return `
        <div class="enLinha">
            <div class="enLinhaData"><b>${esc(e.data ? e.data.split(",")[0] : "—")}</b><small>${esc(mesDe(e))}</small></div>
            <div class="enLinhaLeitura"><span>Leitura</span><b>${formatarPeso(e.leituraAnterior)} ${I.seta} ${formatarPeso(e.leituraAtual)} kWh</b></div>
            <div class="enLinhaConsumo"><span>Consumo</span><b>${kwh(e.consumoMes)}</b></div>
            <div class="enLinhaKwh"><span>kWh</span><b>${rs(e.valorPorKwh)}</b><small>fatura ${rs(e.valorTotalFatura)} / ${kwh(e.consumoTotalFatura)}</small></div>
            <div class="enLinhaValor"><span>A pagar</span><b>${rs(e.valorAPagar)}</b></div>
            <span class="enStatus enStatusPequeno enStatus_${st.chave}">${esc(st.texto)}</span>
            <button class="ltBtnIcone ltBtnExcluir" onclick='excluirEnergia(${jsonAtributo(e.id)})' title="Excluir lançamento" aria-label="Excluir lançamento">${I.lixeira}</button>
        </div>`;
    }).join("");
}

function abrirModalEnergia() {
    document.getElementById("energiaDataInput").value = new Date().toISOString().slice(0, 10);
    document.getElementById("energiaValorFaturaInput").value = "";
    document.getElementById("energiaConsumoFaturaInput").value = "";
    document.getElementById("energiaLeituraAtualInput").value = "";
    let vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 7);
    document.getElementById("energiaVencimentoInput").value = vencimento.toISOString().slice(0, 10);

    let ultima = energiaCacheAdmin[0] || null;
    let leituraAnterior = ultima ? ultima.leituraAtual : 0;
    document.getElementById("energiaLeituraAnteriorInfo").innerText = `Última leitura registrada: ${formatarPeso(leituraAnterior)} kWh`;

    document.getElementById("energiaPreviewKwh").innerText = "";
    document.getElementById("energiaPreviewValor").innerText = "";
    let erroEl = document.getElementById("energiaErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    novaChaveIdempotencia("modalEnergia");
    document.getElementById("modalEnergia").style.display = "flex";
}

function fecharModalEnergia() {
    document.getElementById("modalEnergia").style.display = "none";
}

function atualizarPreviewEnergia() {
    let valorFatura = parseFloat(document.getElementById("energiaValorFaturaInput").value.replace(",", ".")) || 0;
    let consumoFatura = parseFloat(document.getElementById("energiaConsumoFaturaInput").value.replace(",", ".")) || 0;
    let leituraAtual = parseFloat(document.getElementById("energiaLeituraAtualInput").value.replace(",", ".")) || 0;
    let ultima = energiaCacheAdmin[0] || null;
    let leituraAnterior = ultima ? ultima.leituraAtual : 0;

    let previewKwh = document.getElementById("energiaPreviewKwh");
    let previewValor = document.getElementById("energiaPreviewValor");

    if (valorFatura <= 0 || consumoFatura <= 0) {
        previewKwh.innerText = "";
        previewValor.innerText = "";
        return;
    }
    let valorPorKwh = valorFatura / consumoFatura;
    previewKwh.innerText = `Valor por kWh: R$ ${formatarMoeda(valorPorKwh)}`;

    if (leituraAtual > 0) {
        let consumoMes = leituraAtual - leituraAnterior;
        if (consumoMes < 0) {
            previewValor.innerText = "Leitura atual não pode ser menor que a última registrada.";
        } else {
            previewValor.innerText = `Consumo do mês: ${formatarPeso(consumoMes)} kWh — Valor a pagar: R$ ${formatarMoeda(consumoMes * valorPorKwh)}`;
        }
    } else {
        previewValor.innerText = "";
    }
}

async function salvarEnergia() {
    let erroEl = document.getElementById("energiaErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let dataISO = document.getElementById("energiaDataInput").value;
        let valorFatura = parseFloat(document.getElementById("energiaValorFaturaInput").value.replace(",", "."));
        let consumoFatura = parseFloat(document.getElementById("energiaConsumoFaturaInput").value.replace(",", "."));
        let leituraAtual = parseFloat(document.getElementById("energiaLeituraAtualInput").value.replace(",", "."));
        let vencimentoISO = document.getElementById("energiaVencimentoInput").value;

        if (!dataISO) { mostrarErro("Informe a data de referência."); return; }
        if (!Number.isFinite(valorFatura) || valorFatura <= 0) { mostrarErro("Informe o valor total da fatura."); return; }
        if (!Number.isFinite(consumoFatura) || consumoFatura <= 0) { mostrarErro("Informe o consumo total da fatura."); return; }
        if (!Number.isFinite(leituraAtual) || leituraAtual < 0) { mostrarErro("Informe a leitura atual do seu medidor."); return; }
        if (!vencimentoISO) { mostrarErro("Informe o vencimento da conta a pagar."); return; }

        let resp = await fetch(`${API_URL}/api/energia`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({
                id: obterChaveIdempotencia("modalEnergia"),
                data: formatarDataBR(dataISO),
                valorTotalFatura: valorFatura,
                consumoTotalFatura: consumoFatura,
                leituraAtual,
                dataVencimento: formatarDataBR(vencimentoISO)
            })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar (HTTP ${resp.status}).`); return; }

        fecharModalEnergia();
        await abrirTelaEnergia();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function excluirEnergia(id) {
    if (!await confirmarModerno("Excluir este lançamento de energia? A Contas a Pagar vinculada também será excluída (se ainda não paga).")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/energia/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await abrirTelaEnergia();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ========================================
// SALÁRIOS
// ========================================
// Folha de pagamento NÃO tem tabela própria de pagamentos: cada salário de
// um funcionário numa competência é uma contas_pagar comum (1 parcela),
// marcada com funcionarioId/competencia -- pagar/editar/estornar já
// funcionam de graça reaproveitando as funções de Contas a Pagar acima.
// Adiantamento é diferente: já saiu do caixa na hora, então é um
// caixa_lancamentos direto (o servidor cuida disso).
let funcionariosCacheAdmin = [];
let adiantamentosCacheAdmin = [];
let funcionarioEmEdicaoId = null;

function competenciaAtualPadrao() {
    return cpDataLocalISO(new Date()).slice(0, 7);
}

function nomeFuncionario(id) {
    let f = funcionariosCacheAdmin.find(x => x.id === id);
    return f ? f.nome : "—";
}

async function carregarFuncionariosAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/funcionarios`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        funcionariosCacheAdmin = await resp.json();
        return funcionariosCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function carregarAdiantamentosAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/adiantamentos`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        adiantamentosCacheAdmin = await resp.json();
        return adiantamentosCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function abrirTelaSalarios() {
    await Promise.all([carregarFuncionariosAdmin(), carregarAdiantamentosAdmin(), carregarContasPagarAdmin()]);
    mostrarResumoSalarios();
}

const ICONES_SALARIOS = {
    "pessoas": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle><path d=\"M23 21v-2a4 4 0 0 0-3-3.87\"></path><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"></path></svg>",
    "maisPessoa": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle><path d=\"M19 8v6M22 11h-6\"></path></svg>",
    "folha": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"></path><path d=\"M14 2v6h6\"></path><path d=\"M8 13h8M8 17h5\"></path></svg>",
    "dinheiro": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" rx=\"2\"></rect><circle cx=\"12\" cy=\"12\" r=\"2.5\"></circle><path d=\"M6 12h.01M18 12h.01\"></path></svg>",
    "adiantar": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 2v6\"></path><path d=\"M9 5l3-3 3 3\"></path><rect x=\"2\" y=\"10\" width=\"20\" height=\"12\" rx=\"2\"></rect><circle cx=\"12\" cy=\"16\" r=\"2\"></circle></svg>",
    "seta": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 6l6 6-6 6\"></path></svg>",
    "calendario": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2\"></rect><path d=\"M16 2v4M8 2v4M3 10h18\"></path></svg>",
    "check": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M8.5 12l2.5 2.5 4.5-5\"></path></svg>",
    "relogio": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M12 7v5l3 2\"></path></svg>",
    "carteira": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-4a2 2 0 0 0 0 4h4v4a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5\"></path><circle cx=\"17\" cy=\"14\" r=\".6\" fill=\"currentColor\"></circle></svg>"
};

// situação de cada funcionário ativo na competência: salário, adiantado,
// folha gerada/paga e quanto ainda falta pagar
function calcularSituacaoSalarios(competencia) {
    return funcionariosCacheAdmin.filter(f => f.ativo).map(f => {
        let adiantado = adiantamentosCacheAdmin.filter(a => a.funcionarioId === f.id && a.competencia === competencia).reduce((s, a) => s + a.valor, 0);
        let conta = contasPagarCacheAdmin.find(c => c.funcionarioId === f.id && c.competencia === competencia);
        let parcela = conta && conta.parcelas ? conta.parcelas[0] : null;
        let paga = !!(parcela && parcela.paga);
        let liquido = conta ? conta.valorTotal : Math.max(f.salario - adiantado, 0);
        return {
            f, adiantado, conta, parcela, paga, liquido,
            pago: paga ? conta.valorTotal : 0,
            falta: paga ? 0 : liquido,
            vencimento: parcela && parcela.dataVencimento ? parcela.dataVencimento.split(",")[0] : null
        };
    });
}

function mostrarResumoSalarios() {
    let competencia = competenciaAtualPadrao();
    let set = (id, v) => { let el = document.getElementById(id); if (el) el.innerText = v; };
    let rs = v => "R$ " + formatarMoeda(v);
    let esc = escaparHtmlPesagem;
    let I = ICONES_SALARIOS;
    let linhas = calcularSituacaoSalarios(competencia);
    let [ano, mes] = competencia.split("-");
    let nomeMes = new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString("pt-BR", { month: "long" });

    let bruto = linhas.reduce((s, l) => s + l.f.salario, 0);
    let adiantado = adiantamentosCacheAdmin.filter(a => a.competencia === competencia).reduce((s, a) => s + a.valor, 0);
    let pago = linhas.reduce((s, l) => s + l.pago, 0);
    let falta = linhas.reduce((s, l) => s + l.falta, 0);
    let folhaGerada = contasPagarCacheAdmin.filter(c => c.competencia === competencia && c.categoria === "Salário").reduce((s, c) => s + c.valorTotal, 0);

    set("salCompetenciaTitulo", `Folha de ${nomeMes} de ${ano}`);
    set("salFaltaPagar", rs(falta));
    set("salTotalBruto", rs(bruto));
    set("salAdiantamentosMes", rs(adiantado));
    set("salPagoFolha", rs(pago));
    set("salFolhaMesBruta", rs(folhaGerada));
    set("salFuncionariosAtivos", String(linhas.length));

    // barra: adiantado + pago + falta, do total de salários
    let base = Math.max(bruto, adiantado + pago + falta, 0.01);
    let barra = document.getElementById("salBarra");
    if (barra) barra.innerHTML = [["#fbbf24", adiantado, "Adiantado"], ["#3ddc84", pago, "Pago na folha"], ["#60a5fa", falta, "Falta pagar"]]
        .filter(([, v]) => v > 0).map(([cor, v, nome]) => `<i style="width:${v / base * 100}%; background:${cor}" title="${nome}: ${rs(v)}"></i>`).join("");

    let geradas = linhas.filter(l => l.conta).length;
    let pagas = linhas.filter(l => l.paga).length;
    let status = document.getElementById("salStatusFolha");
    if (status) {
        let [classe, icone, texto] = linhas.length === 0 ? ["", I.pessoas, "Nenhum funcionário ativo"]
            : pagas === linhas.length ? ["salStatusOk", I.check, "Folha toda paga"]
            : geradas === 0 ? ["salStatusPendente", I.relogio, "Folha ainda não gerada"]
            : ["salStatusParcial", I.folha, `Folha gerada · ${pagas} de ${linhas.length} pagos`];
        status.className = "salStatusFolha " + classe;
        status.innerHTML = icone + "<span>" + texto + "</span>";
    }
    let qtdAdiantamentos = adiantamentosCacheAdmin.filter(a => a.competencia === competencia).length;
    set("salHubFuncionarios", `${linhas.length} ${linhas.length === 1 ? "funcionário ativo" : "funcionários ativos"}`);
    set("salHubFolha", geradas === 0 ? `${nomeMes}: ainda não gerada` : `${nomeMes}: ${pagas} de ${linhas.length} pagos`);
    set("salHubAdiantamentos", `${qtdAdiantamentos} no mês · ${rs(adiantado)}`);

    let lista = document.getElementById("salListaEquipe");
    if (!lista) return;
    if (linhas.length === 0) {
        lista.innerHTML = `<p class="ltVazio">Nenhum funcionário ativo. Cadastre em <b>Novo funcionário</b>.</p>`;
        return;
    }
    lista.innerHTML = linhas.sort((a, b) => a.f.nome.localeCompare(b.f.nome, "pt-BR")).map(l => {
        let { iniciais, cor } = avatarUsuario({ nome: l.f.nome, usuario: l.f.nome });
        let pctAdiantado = l.f.salario > 0 ? Math.min(l.adiantado / l.f.salario * 100, 100) : 0;
        let situacao = l.paga ? `<span class="ltStatus ltStatusAtivo">Pago</span>`
            : l.conta ? `<span class="ltStatus salSeloGerada">Vence ${esc(l.vencimento || "—")}</span>`
            : `<span class="ltStatus ltStatusInativo">A gerar · dia ${l.f.diaPagamento}</span>`;
        return `
        <div class="salPessoa">
            <span class="usAvatar" style="--corAvatar:${cor}">${esc(iniciais)}</span>
            <div class="salPessoaNome"><b>${esc(l.f.nome)}</b><small>${l.f.cargo ? esc(l.f.cargo) + " · " : ""}salário ${rs(l.f.salario)}</small></div>
            <div class="salPessoaAdiantado" data-rotulo="Adiantado">
                <div class="salPessoaLinha"><span>Adiantado</span><b>${rs(l.adiantado)}</b></div>
                <div class="almBarra"><i style="width:${pctAdiantado}%; background:linear-gradient(90deg,#f59e0b,#fbbf24)"></i></div>
            </div>
            <div class="salPessoaFalta"><span>${l.paga ? "Recebeu na folha" : "Falta receber"}</span><b class="${l.paga ? "fcEntrada" : ""}">${rs(l.paga ? l.pago : l.falta)}</b></div>
            ${situacao}
            <button class="ltBtnIcone salBtnAdiantarPessoa" onclick='abrirModalAdiantamento(${jsonAtributo(l.f.id)})' title="Lançar adiantamento para ${esc(l.f.nome)}" aria-label="Lançar adiantamento">${I.adiantar}</button>
        </div>`;
    }).join("");
}

// ---------- Funcionários ----------

async function abrirTelaFuncionarios() {
    await carregarFuncionariosAdmin();
    mostrarFuncionarios();
}

function mostrarFuncionarios() {
    let corpo = document.getElementById("corpoTabelaFuncionarios");
    if (!corpo) return;
    if (funcionariosCacheAdmin.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6">Nenhum funcionário cadastrado.</td></tr>`;
        return;
    }
    corpo.innerHTML = funcionariosCacheAdmin.map(f => `
        <tr>
            <td>${f.nome}</td>
            <td>${f.cargo || "—"}</td>
            <td>R$ ${formatarMoeda(f.salario)}</td>
            <td>Dia ${f.diaPagamento}</td>
            <td style="color:${f.ativo ? "#0ca30c" : "#d03b3b"}">${f.ativo ? "Ativo" : "Inativo"}</td>
            <td class="acoesUsuario">
                <button onclick='abrirModalFuncionario(${jsonAtributo(f.id)})'>✏️</button>
                <button onclick='excluirFuncionario(${jsonAtributo(f.id)}, ${jsonAtributo(f.nome)})'>🗑️</button>
            </td>
        </tr>
    `).join("");
}

function abrirModalFuncionario(id) {
    funcionarioEmEdicaoId = id || null;
    let f = id ? funcionariosCacheAdmin.find(x => x.id === id) : null;
    document.getElementById("modalFuncionarioTitulo").innerText = f ? "✏️ Editar Funcionário" : "➕ Novo Funcionário";
    document.getElementById("funcNomeInput").value = f ? f.nome : "";
    document.getElementById("funcCargoInput").value = f ? (f.cargo || "") : "";
    document.getElementById("funcSalarioInput").value = f ? String(f.salario).replace(".", ",") : "";
    document.getElementById("funcDiaPagamentoInput").value = f ? f.diaPagamento : "5";
    document.getElementById("funcDataAdmissaoInput").value = f ? (extrairDataISO(f.dataAdmissao) || "") : "";
    document.getElementById("funcObservacoesInput").value = f ? (f.observacoes || "") : "";
    let linhaAtivo = document.getElementById("funcAtivoLinha");
    if (linhaAtivo) linhaAtivo.style.display = f ? "flex" : "none";
    document.getElementById("funcAtivoInput").checked = f ? f.ativo : true;
    let erroEl = document.getElementById("funcErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalFuncionario").style.display = "flex";
}

function fecharModalFuncionario() {
    document.getElementById("modalFuncionario").style.display = "none";
    funcionarioEmEdicaoId = null;
}

async function salvarFuncionario() {
    let erroEl = document.getElementById("funcErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let nome = document.getElementById("funcNomeInput").value.trim();
        let cargo = document.getElementById("funcCargoInput").value.trim();
        let salario = parseFloat(document.getElementById("funcSalarioInput").value.replace(",", "."));
        let diaPagamento = parseInt(document.getElementById("funcDiaPagamentoInput").value, 10);
        let dataAdmissaoISO = document.getElementById("funcDataAdmissaoInput").value;
        let observacoes = document.getElementById("funcObservacoesInput").value.trim();

        if (!nome) { mostrarErro("Informe o nome."); return; }
        if (!Number.isFinite(salario) || salario <= 0) { mostrarErro("Informe um salário válido."); return; }
        if (!Number.isInteger(diaPagamento) || diaPagamento < 1 || diaPagamento > 31) { mostrarErro("Dia de pagamento inválido (1 a 31)."); return; }

        let corpo = {
            nome, cargo: cargo || null, salario, diaPagamento,
            dataAdmissao: dataAdmissaoISO ? formatarDataBR(dataAdmissaoISO) : null,
            observacoes: observacoes || null
        };

        let resp;
        if (funcionarioEmEdicaoId) {
            corpo.ativo = document.getElementById("funcAtivoInput").checked;
            resp = await fetch(`${API_URL}/api/funcionarios/${funcionarioEmEdicaoId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(corpo)
            });
        } else {
            resp = await fetch(`${API_URL}/api/funcionarios`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                body: JSON.stringify(corpo)
            });
        }
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar (HTTP ${resp.status}).`); return; }

        fecharModalFuncionario();
        await abrirTelaFuncionarios();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function excluirFuncionario(id, nome) {
    if (!await confirmarModerno(`Excluir o funcionário "${nome}"? Só é possível se ele nunca teve folha ou adiantamento lançado — considere desativá-lo em vez de excluir.`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/funcionarios/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await abrirTelaFuncionarios();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ---------- Folha de Pagamento ----------

async function abrirTelaFolhaPagamento() {
    let input = document.getElementById("folhaCompetenciaInput");
    if (input && !input.value) input.value = competenciaAtualPadrao();
    await Promise.all([carregarFuncionariosAdmin(), carregarAdiantamentosAdmin(), carregarContasPagarAdmin()]);
    mostrarFolhaPagamento();
}

function mostrarFolhaPagamento() {
    let corpo = document.getElementById("corpoTabelaFolhaPagamento");
    if (!corpo) return;
    let input = document.getElementById("folhaCompetenciaInput");
    let competencia = input ? input.value : "";
    if (!competencia) {
        corpo.innerHTML = `<tr><td colspan="7">Selecione uma competência.</td></tr>`;
        return;
    }

    let ativos = funcionariosCacheAdmin.filter(f => f.ativo);
    if (ativos.length === 0) {
        corpo.innerHTML = `<tr><td colspan="7">Nenhum funcionário ativo cadastrado.</td></tr>`;
        return;
    }

    corpo.innerHTML = ativos.map(f => {
        let contaGerada = contasPagarCacheAdmin.find(c => c.funcionarioId === f.id && c.competencia === competencia);
        let adiantamentosFunc = adiantamentosCacheAdmin.filter(a => a.funcionarioId === f.id && a.competencia === competencia);
        let totalAdiantamentos = adiantamentosFunc.reduce((s, a) => s + a.valor, 0);

        if (contaGerada) {
            let parcela = contaGerada.parcelas[0];
            let status = statusParcela(parcela);
            let acoes = status.chave === "paga"
                ? `<button onclick='gerarReciboSalario(${jsonAtributo(contaGerada.id)})'>🖨️ Recibo</button><button onclick='estornarPagamentoParcela(${jsonAtributo(parcela.id)})'>↩️ Estornar</button>`
                : `<button onclick='abrirModalPagarParcela(${jsonAtributo(parcela.id)})'>💰 Pagar</button><button onclick='abrirModalEditarParcela(${jsonAtributo(parcela.id)})'>✏️</button>`;
            return `
                <tr>
                    <td>${f.nome}</td>
                    <td>R$ ${formatarMoeda(f.salario)}</td>
                    <td>R$ ${formatarMoeda(totalAdiantamentos)}</td>
                    <td>R$ ${formatarMoeda(contaGerada.valorTotal)}</td>
                    <td>${parcela.dataVencimento ? parcela.dataVencimento.split(",")[0] : "—"}</td>
                    <td style="color:${status.cor}">${status.texto}</td>
                    <td class="acoesUsuario">${acoes}</td>
                </tr>
            `;
        }

        let valorLiquidoProjetado = f.salario - totalAdiantamentos;
        return `
            <tr style="opacity:0.75">
                <td>${f.nome}</td>
                <td>R$ ${formatarMoeda(f.salario)}</td>
                <td>R$ ${formatarMoeda(totalAdiantamentos)}</td>
                <td>R$ ${formatarMoeda(valorLiquidoProjetado)}</td>
                <td>—</td>
                <td style="color:#7c869e">Folha não gerada</td>
                <td class="acoesUsuario">—</td>
            </tr>
        `;
    }).join("");
}

async function gerarFolhaPagamento() {
    let input = document.getElementById("folhaCompetenciaInput");
    let competencia = input ? input.value : "";
    if (!competencia) { await alertarModerno("Selecione a competência antes de gerar a folha."); return; }
    if (!await confirmarModerno(`Gerar a folha de pagamento da competência ${competencia} para os funcionários ativos que ainda não têm folha gerada nesse mês?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/folha-pagamento/gerar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ competencia })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao gerar folha (HTTP ${resp.status}).`); return; }

        let msg = `Folha gerada para ${dados.geradas.length} funcionário(s).`;
        if (dados.puladas.length > 0) msg += ` Pulados (já tinham folha gerada nesse mês, ou valor líquido zerado/negativo): ${dados.puladas.join(", ")}.`;
        await alertarModerno(msg);

        await carregarContasPagarAdmin();
        mostrarFolhaPagamento();
        mostrarResumoSalarios();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ---------- Adiantamentos ----------

async function abrirTelaAdiantamentos() {
    await Promise.all([carregarFuncionariosAdmin(), carregarAdiantamentosAdmin()]);
    mostrarAdiantamentos();
}

function mostrarAdiantamentos() {
    let corpo = document.getElementById("corpoTabelaAdiantamentos");
    if (!corpo) return;
    if (adiantamentosCacheAdmin.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6">Nenhum adiantamento registrado.</td></tr>`;
        return;
    }
    corpo.innerHTML = adiantamentosCacheAdmin.map(a => `
        <tr>
            <td>${a.data ? a.data.split(",")[0] : "—"}</td>
            <td>${nomeFuncionario(a.funcionarioId)}</td>
            <td>${a.competencia}</td>
            <td>R$ ${formatarMoeda(a.valor)}</td>
            <td>${escaparHtmlPesagem(a.observacoes || "—")}</td>
            <td class="acoesUsuario">
                <button onclick='gerarReciboVale(${jsonAtributo(a.id)})'>🖨️ Recibo</button>
                <button onclick='excluirAdiantamento(${jsonAtributo(a.id)}, ${jsonAtributo(nomeFuncionario(a.funcionarioId))})'>🗑️</button>
            </td>
        </tr>
    `).join("");
}

async function abrirModalAdiantamento(funcionarioId) {
    await carregarFuncionariosAdmin();
    let select = document.getElementById("adiFuncionarioInput");
    select.innerHTML = `<option value="">Selecione o funcionário</option>` +
        funcionariosCacheAdmin.filter(f => f.ativo).map(f => `<option value="${f.id}">${escaparHtmlPesagem(f.nome)}</option>`).join("");
    if (funcionarioId) select.value = funcionarioId;
    document.getElementById("adiValorInput").value = "";
    document.getElementById("adiDataInput").value = cpDataLocalISO(new Date());
    document.getElementById("adiCompetenciaInput").value = competenciaAtualPadrao();
    document.getElementById("adiObservacoesInput").value = "";
    let erroEl = document.getElementById("adiErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    novaChaveIdempotencia("modalAdiantamento");
    document.getElementById("modalAdiantamento").style.display = "flex";
}

function fecharModalAdiantamento() {
    document.getElementById("modalAdiantamento").style.display = "none";
}

async function salvarAdiantamento() {
    let erroEl = document.getElementById("adiErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let funcionarioId = document.getElementById("adiFuncionarioInput").value;
        let valor = parseFloat(document.getElementById("adiValorInput").value.replace(",", "."));
        let dataISO = document.getElementById("adiDataInput").value;
        let competencia = document.getElementById("adiCompetenciaInput").value;
        let observacoes = document.getElementById("adiObservacoesInput").value.trim();

        if (!funcionarioId) { mostrarErro("Selecione o funcionário."); return; }
        if (!Number.isFinite(valor) || valor <= 0) { mostrarErro("Informe um valor válido."); return; }
        if (!dataISO) { mostrarErro("Informe a data."); return; }
        if (!competencia) { mostrarErro("Informe a competência."); return; }

        let resp = await fetch(`${API_URL}/api/adiantamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({
                id: obterChaveIdempotencia("modalAdiantamento"),
                funcionarioId, valor, data: formatarDataBR(dataISO), competencia,
                observacoes: observacoes || null
            })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar (HTTP ${resp.status}).`); return; }

        fecharModalAdiantamento();
        await abrirTelaAdiantamentos();
        mostrarResumoSalarios();
        atualizarRelatoriosFinanceirosAposMudanca();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function excluirAdiantamento(id, nomeFunc) {
    if (!await confirmarModerno(`Excluir o adiantamento de ${nomeFunc}? O lançamento correspondente no Fluxo de Caixa também será removido.`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/adiantamentos/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await abrirTelaAdiantamentos();
        atualizarRelatoriosFinanceirosAposMudanca();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ---------- Recibos (PDF) ----------

function formatarCompetenciaExtenso(competencia) {
    if (!competencia) return "—";
    let [ano, mes] = competencia.split("-");
    let nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    let idx = parseInt(mes, 10) - 1;
    return (nomes[idx] || mes) + "/" + ano;
}

function assinaturaPdf(pdf, y, nomeAssinante, papel) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text("_______________________________________", 10, y);
    y += 6;
    pdf.text(`${nomeAssinante} — ${papel}`, 10, y);
    return y;
}

// Abre o PDF numa aba nova e já dispara a caixa de diálogo de impressão do
// navegador, em vez de baixar o arquivo -- é assim que o Herlon realmente
// usa os recibos (imprime na hora, não guarda o PDF).
function abrirPdfParaImpressao(pdf) {
    pdf.autoPrint();
    window.open(pdf.output("bloburl"), "_blank");
}

// linha pontilhada desenhada "na mão" (segmentos curtos) em vez de
// setLineDashPattern -- evita depender de uma API do jsPDF que não é usada
// em nenhum outro lugar do sistema e cuja disponibilidade nessa versão
// vendorizada não foi confirmada.
function linhaTracejadaPdf(pdf, y) {
    pdf.setDrawColor(150);
    for (let x = 10; x < 200; x += 4) pdf.line(x, y, x + 2, y);
    pdf.setDrawColor(0);
}

// Recibo de vale compacto: imprime só no primeiro terço de uma folha A4,
// com uma linha de corte indicando onde separar -- o resto da folha fica
// em branco de propósito. É assim que o Herlon economiza papel: imprime um
// vale, corta na linha, reaproveita o pedaço restante da mesma folha (que
// ainda tem ~2/3 de A4, mais que o suficiente) pra imprimir o PRÓXIMO vale
// (de outro adiantamento/funcionário, cada um com sua própria impressão),
// e repete uma terceira vez antes de a folha acabar.
function desenharReciboVale(pdf, a, nomeFunc, cargoFunc) {
    let y = 8;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(nomeFazendaAtual().toUpperCase(), 10, y);
    y += 5;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("RECIBO DE ADIANTAMENTO (VALE)", 10, y);
    y += 3;
    pdf.line(10, y, 200, y);
    y += 7;

    function campo(x, label, valor) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(label, x, y);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(valor, x, y + 5);
    }
    campo(10, "FUNCIONÁRIO", nomeFunc);
    campo(140, "CARGO", cargoFunc);
    y += 13;
    campo(10, "COMPETÊNCIA (mês abatido)", formatarCompetenciaExtenso(a.competencia));
    campo(90, "DATA", a.data ? a.data.split(",")[0] : "—");
    campo(140, "VALOR", "R$ " + formatarMoeda(a.valor));
    y += 12;

    if (a.observacoes) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(`Obs.: ${a.observacoes}`.slice(0, 100), 10, y);
        y += 5;
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    let declaracao = `Recebi de ${nomeFazendaAtual().toUpperCase()} a quantia de R$ ${formatarMoeda(a.valor)} referente a adiantamento (vale) a ser descontado na folha de pagamento da competência de ${formatarCompetenciaExtenso(a.competencia)}.`;
    let linhasDeclaracao = pdf.splitTextToSize(declaracao, 190);
    pdf.text(linhasDeclaracao, 10, y);
    y += linhasDeclaracao.length * 4 + 10;

    pdf.setFontSize(8);
    pdf.text("_______________________________", 10, y);
    pdf.text("_______________________________", 115, y);
    y += 4;
    pdf.text("Assinatura do Funcionário", 10, y);
    pdf.text("Assinatura do Responsável", 115, y);
}

async function gerarReciboVale(adiantamentoId) {
    let a = adiantamentosCacheAdmin.find(x => x.id === adiantamentoId);
    if (!a) { await alertarModerno("Adiantamento não encontrado."); return; }
    let f = funcionariosCacheAdmin.find(x => x.id === a.funcionarioId);
    let nomeFunc = f ? f.nome : "—";
    let cargoFunc = f && f.cargo ? f.cargo : "—";

    const { jsPDF } = window.jspdf;
    let pdf = new jsPDF();

    let alturaBloco = 99; // 297mm (A4) / 3 -- só o primeiro terço é usado
    desenharReciboVale(pdf, a, nomeFunc, cargoFunc);
    linhaTracejadaPdf(pdf, alturaBloco);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7);
    pdf.setTextColor(150);
    pdf.text("✂ corte aqui — o restante da folha fica em branco para imprimir o próximo vale", 105, alturaBloco + 4, { align: "center" });
    pdf.setTextColor(0);

    abrirPdfParaImpressao(pdf);
}

async function gerarReciboSalario(contaId) {
    let c = contasPagarCacheAdmin.find(x => x.id === contaId);
    if (!c) { await alertarModerno("Folha não encontrada."); return; }
    let parcela = c.parcelas[0];
    if (!parcela || !parcela.paga) { await alertarModerno("Essa folha ainda não foi paga."); return; }

    let f = funcionariosCacheAdmin.find(x => x.id === c.funcionarioId);
    let nomeFunc = f ? f.nome : "—";
    let cargoFunc = f && f.cargo ? f.cargo : "—";
    let adiantamentosFunc = adiantamentosCacheAdmin.filter(x => x.funcionarioId === c.funcionarioId && x.competencia === c.competencia);
    let totalAdiantamentos = adiantamentosFunc.reduce((s, x) => s + x.valor, 0);
    // reconstrói o bruto usado NA ÉPOCA (conta.valorTotal já é o líquido
    // programado = salário daquele momento - adiantamentos) em vez de ler
    // funcionarios.salario, que pode ter mudado desde então -- mesmo
    // cuidado de "snapshot, não recalcula depois" já usado em Energia.
    let salarioBruto = c.valorTotal + totalAdiantamentos;

    const { jsPDF } = window.jspdf;
    let pdf = new jsPDF();
    let y = 20;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(nomeFazendaAtual().toUpperCase(), 105, y, { align: "center" });
    y += 7;
    pdf.setFontSize(13);
    pdf.text("RECIBO DE PAGAMENTO DE SALÁRIO", 105, y, { align: "center" });
    y += 4;
    pdf.line(10, y, 200, y);
    y += 10;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10, y);
    y += 12;

    function linha(label, valor, negrito) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.text(label, 10, y);
        pdf.setFont("helvetica", negrito === false ? "normal" : "bold");
        pdf.text(valor, 95, y);
        y += 8;
    }

    linha("Funcionário:", nomeFunc);
    linha("Cargo:", cargoFunc);
    linha("Competência:", formatarCompetenciaExtenso(c.competencia));
    y += 2;
    pdf.line(10, y - 4, 200, y - 4);
    y += 4;

    linha("Salário bruto:", "R$ " + formatarMoeda(salarioBruto));
    linha("(-) Adiantamentos descontados:", "R$ " + formatarMoeda(totalAdiantamentos));
    if (adiantamentosFunc.length > 0) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        adiantamentosFunc.forEach(x => {
            pdf.text(`     • ${x.data ? x.data.split(",")[0] : "—"} — R$ ${formatarMoeda(x.valor)}${x.observacoes ? " (" + x.observacoes + ")" : ""}`, 12, y);
            y += 5.5;
        });
        y += 2;
    }
    pdf.line(10, y - 2, 200, y - 2);
    y += 6;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Valor líquido pago:", 10, y);
    pdf.text("R$ " + formatarMoeda(parcela.valor), 95, y);
    y += 10;

    linha("Data do pagamento:", parcela.dataPagamento ? parcela.dataPagamento.split(",")[0] : "—");
    y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    let declaracao = `Recebi de ${nomeFazendaAtual().toUpperCase()} a quantia líquida de R$ ${formatarMoeda(parcela.valor)}, referente ao pagamento do salário da competência de ${formatarCompetenciaExtenso(c.competencia)}, dando plena e geral quitação.`;
    let linhasDeclaracao = pdf.splitTextToSize(declaracao, 180);
    pdf.text(linhasDeclaracao, 10, y);
    y += linhasDeclaracao.length * 6 + 24;

    y = assinaturaPdf(pdf, y, nomeFunc, "Assinatura do Funcionário");
    y += 20;
    assinaturaPdf(pdf, y, nomeFazendaAtual(), "Assinatura do Responsável");

    abrirPdfParaImpressao(pdf);
}

// ========================================
// VACAS MATRIZ
// ========================================
// Controle do plantel reprodutivo, isolado de propósito: nenhuma linha
// aqui embaixo é lida por nenhum cálculo do resto do sistema (Dashboard,
// Patrimônio, Custo por Lote, Fluxo de Caixa continuam iguais).
let pastosCacheAdmin = [];
let vacasMatrizCacheAdmin = [];
let nascimentosCacheAdmin = [];
let vacaEditandoId = null;
let eventoNascimentoId = null;
let eventoNascimentoTipo = null; // "apartar" | "morte"

async function abrirTelaVacasMatriz() {
    await Promise.all([carregarPastosAdmin(), carregarVacasMatrizAdmin(), carregarNascimentosAdmin()]);
    mostrarResumoVacasMatriz();
}

function mostrarResumoVacasMatriz() {
    let elAtivas = document.getElementById("vmVacasAtivas");
    if (!elAtivas) return;
    let esc = escaparHtmlPesagem;
    let set = (id, v) => { let el = document.getElementById(id); if (el) el.innerText = v; };
    let anoAtual = new Date().getFullYear();
    let doAno = dataStr => { let dm = extrairMesAnoDaData(dataStr); return dm && dm.ano === anoAtual; };

    let ativas = vacasMatrizCacheAdmin.filter(v => v.status === "ativa");
    let mortas = vacasMatrizCacheAdmin.filter(v => v.status === "morta").length;
    let descartadas = vacasMatrizCacheAdmin.length - ativas.length - mortas;
    elAtivas.innerText = ativas.length;
    set("vmVacasDetalhe", [mortas ? `${mortas} morta${mortas > 1 ? "s" : ""}` : "", descartadas ? `${descartadas} descartada${descartadas > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ") || "Nenhuma perda ou descarte registrado");

    let nascidosAno = nascimentosCacheAdmin.filter(n => doAno(n.dataNascimento));
    set("vmNascimentosAno", nascidosAno.length);
    let machos = nascidosAno.filter(n => n.sexo === "macho").length;
    let femeas = nascidosAno.filter(n => n.sexo === "femea").length;
    set("vmMachosAno", machos);
    set("vmFemeasAno", femeas);
    let barra = document.getElementById("vmSexoBarra");
    if (barra) barra.innerHTML = machos + femeas > 0
        ? `<i style="width:${machos / (machos + femeas) * 100}%; background:#60a5fa"></i><i style="width:${femeas / (machos + femeas) * 100}%; background:#f472b6"></i>`
        : "";

    // natalidade: vacas (do plantel ativo) que tiveram pelo menos 1 bezerro no ano
    let maesNoAno = new Set(nascidosAno.map(n => n.vacaMaeNumero).filter(Boolean));
    let pariram = ativas.filter(v => maesNoAno.has(v.numero)).length;
    let natalidade = ativas.length ? Math.round(pariram / ativas.length * 100) : 0;
    set("vmNatalidade", natalidade + "%");
    set("vmNatalidadeTitulo", `Natalidade em ${anoAtual} · ${pariram} de ${ativas.length}`);
    let anel = document.getElementById("vmAnelValor");
    if (anel) {
        let circ = 2 * Math.PI * 50;
        anel.setAttribute("stroke-dasharray", `${circ * natalidade / 100} ${circ}`);
    }

    set("vmAoPe", nascimentosCacheAdmin.filter(n => n.status === "vivo").length);

    let mortesVacasAno = vacasMatrizCacheAdmin.filter(v => v.status === "morta" && v.dataMorte && doAno(v.dataMorte)).length;
    let mortesBezerrosAno = nascimentosCacheAdmin.filter(n => n.status === "morto" && n.dataMorte && doAno(n.dataMorte)).length;
    set("vmPerdasAno", mortesVacasAno + mortesBezerrosAno);
    document.querySelector(".vmKpiPerdas")?.classList.toggle("vmKpiPerdasAlerta", mortesVacasAno + mortesBezerrosAno > 0);
    let elPerdas = document.getElementById("vmPerdasAno");
    if (elPerdas && mortesVacasAno + mortesBezerrosAno > 0) elPerdas.title = `${mortesVacasAno} vaca(s) e ${mortesBezerrosAno} bezerro(s)`;

    // mesma faixa (8 a <12 meses, ainda vivo) do aviso "Pronto p/ apartar" da
    // tabela de Nascimentos
    let prontos = nascimentosCacheAdmin.filter(n => {
        if (n.status !== "vivo") return false;
        let meses = calcularIdadeEmMeses(n.dataNascimento);
        return meses !== null && meses >= 8 && meses < 12;
    });
    set("vmBezerrosApartar", prontos.filter(n => n.sexo === "macho").length);
    set("vmBezerrasApartar", prontos.filter(n => n.sexo === "femea").length);
    document.querySelector(".vmKpiApartar")?.classList.toggle("vmKpiDestaque", prontos.length > 0);

    // nascimentos por mês do ano
    let porMes = Array(12).fill(0);
    nascidosAno.forEach(n => { let dm = extrairMesAnoDaData(n.dataNascimento); if (dm) porMes[dm.mes]++; });
    let maxMes = Math.max(1, ...porMes);
    let mesAtual = new Date().getMonth();
    set("vmAnoGrafico", String(anoAtual));
    let meses = document.getElementById("vmMeses");
    if (meses) meses.innerHTML = porMes.map((q, i) => `
        <div class="vmMes${i === mesAtual ? " vmMesAtual" : ""}${i > mesAtual ? " vmMesFuturo" : ""}" title="${NOMES_MESES_RESULTADO[i]}: ${q} nascimento(s)">
            <span class="vmMesQtd">${q || ""}</span>
            <div class="vmMesColuna"><i style="height:${q / maxMes * 100}%"></i></div>
            <small>${NOMES_MESES_RESULTADO[i].slice(0, 3)}</small>
        </div>`).join("");

    // vacas ativas por pasto
    let porPasto = {};
    ativas.forEach(v => { let p = v.pastoNome || "Sem pasto"; porPasto[p] = (porPasto[p] || 0) + 1; });
    let pastos = Object.keys(porPasto).sort((a, b) => porPasto[b] - porPasto[a]);
    let maxPasto = Math.max(1, ...Object.values(porPasto));
    let elPastos = document.getElementById("vmPorPasto");
    if (elPastos) elPastos.innerHTML = pastos.length === 0 ? `<p class="vmVazio">Nenhuma vaca ativa.</p>` : pastos.map(p => `
        <div class="vmLinhaBarra">
            <div class="vmLinhaTopo"><span>${esc(p)}</span><b>${porPasto[p]}</b></div>
            <div class="almBarra"><i style="width:${porPasto[p] / maxPasto * 100}%; background:linear-gradient(90deg,#65a30d,#a3e635)"></i></div>
        </div>`).join("");

    // lista de quem já pode apartar (mais velhos primeiro)
    let elLista = document.getElementById("vmListaApartar");
    if (elLista) {
        let ordenados = prontos.map(n => ({ n, meses: calcularIdadeEmMeses(n.dataNascimento) })).sort((a, b) => b.meses - a.meses);
        elLista.innerHTML = ordenados.length === 0 ? `<p class="vmVazio">Nenhum bezerro na faixa de 8 a 12 meses agora.</p>` :
            ordenados.slice(0, 6).map(({ n, meses }) => `
            <div class="vmApartarItem">
                <span class="vmSexo ${n.sexo === "macho" ? "vmSexoMacho" : "vmSexoFemea"}">${n.sexo === "macho" ? "M" : "F"}</span>
                <div><b>${n.numeroBezerro ? "Nº " + esc(n.numeroBezerro) : "Sem número"}</b><small>${n.sexo === "femea" ? "filha" : "filho"} da vaca ${esc(n.vacaMaeNumero || "—")}${n.pastoNome ? " · " + esc(n.pastoNome) : ""}</small></div>
                <span class="vmIdade">${meses} meses</span>
            </div>`).join("") + (ordenados.length > 6 ? `<p class="vmVazio">e mais ${ordenados.length - 6} — veja em Nascimentos.</p>` : "");
    }

    let pastosAtivos = pastosCacheAdmin.filter(p => p.ativo).length;
    set("vmHubPastos", `${pastosAtivos} ${pastosAtivos === 1 ? "pasto ativo" : "pastos ativos"}`);
    set("vmHubVacas", `${ativas.length} ativas · ${vacasMatrizCacheAdmin.length} cadastradas`);
    set("vmHubNascimentos", `${nascidosAno.length} em ${anoAtual} · ${prontos.length} p/ apartar`);
}

// ---------- PASTOS (mirrors Lotes) ----------
async function carregarPastosAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/pastos`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        pastosCacheAdmin = await resp.json();
        return pastosCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function carregarPastos() {
    let corpo = document.getElementById("corpoTabelaPastos");
    if (!corpo) return;
    await carregarPastosAdmin();
    if (pastosCacheAdmin.length === 0) {
        corpo.innerHTML = `<tr><td colspan="3">Nenhum pasto cadastrado ainda.</td></tr>`;
        return;
    }
    corpo.innerHTML = pastosCacheAdmin.map(p => `
        <tr>
            <td>${p.nome}</td>
            <td>${p.ativo ? "✅ Ativo" : "🚫 Inativo"}</td>
            <td class="acoesUsuario">
                <button onclick='alternarAtivoPasto(${jsonAtributo(p.id)}, ${!p.ativo})'>${p.ativo ? "🚫" : "✅"}</button>
                <button onclick='excluirPasto(${jsonAtributo(p.id)}, ${jsonAtributo(p.nome)})'>🗑️</button>
            </td>
        </tr>
    `).join("");
}

function abrirModalPasto() {
    document.getElementById("pastoNomeInput").value = "";
    let erroEl = document.getElementById("pastoErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalPasto").style.display = "flex";
}

function fecharModalPasto() {
    document.getElementById("modalPasto").style.display = "none";
}

async function salvarPasto() {
    let erroEl = document.getElementById("pastoErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }
    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }
        let nome = document.getElementById("pastoNomeInput").value.trim();
        if (!nome) { mostrarErro("Informe o nome do pasto."); return; }
        let resp = await fetch(`${API_URL}/api/pastos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ nome })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao criar pasto (HTTP ${resp.status}).`); return; }
        fecharModalPasto();
        carregarPastos();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function alternarAtivoPasto(id, novoAtivo) {
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/pastos/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao atualizar pasto (HTTP ${resp.status}).`); return; }
        carregarPastos();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

async function excluirPasto(id, nome) {
    if (!await confirmarModerno(`Excluir o pasto "${nome}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/pastos/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir pasto (HTTP ${resp.status}).`); return; }
        carregarPastos();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ---------- VACAS MATRIZ ----------
async function carregarVacasMatrizAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/vacas-matriz`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        vacasMatrizCacheAdmin = await resp.json();
        return vacasMatrizCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function abrirTelaVacas() {
    await Promise.all([carregarVacasMatrizAdmin(), carregarNascimentosAdmin()]);
    mostrarVacas();
}

function mostrarVacas() {
    let corpo = document.getElementById("corpoTabelaVacas");
    if (!corpo) return;
    let filtro = document.getElementById("vmFiltroStatus");
    let statusFiltro = filtro ? filtro.value : "";
    let lista = statusFiltro ? vacasMatrizCacheAdmin.filter(v => v.status === statusFiltro) : vacasMatrizCacheAdmin;

    if (lista.length === 0) {
        corpo.innerHTML = `<tr><td colspan="8">Nenhuma vaca encontrada.</td></tr>`;
        return;
    }

    function textoStatusVaca(v) {
        if (v.status === "ativa") return { texto: "✅ Ativa", cor: "#0ca30c" };
        if (v.status === "morta") return { texto: "⚰️ Morta", cor: "#d03b3b" };
        return { texto: "➖ Descartada", cor: "#52514e" };
    }

    corpo.innerHTML = lista.map(v => {
        let st = textoStatusVaca(v);
        let qtdFilhos = nascimentosCacheAdmin.filter(n => n.vacaMaeNumero === v.numero).length;
        return `
            <tr>
                <td>${v.numero}</td>
                <td>${v.apelido || "—"}</td>
                <td>${escaparHtmlPesagem(v.raca || "—")}</td>
                <td>${formatarIdadeAnimal(v.dataNascimento)}</td>
                <td>${escaparHtmlPesagem(v.pastoNome || "—")}</td>
                <td style="color:${st.cor}">${st.texto}</td>
                <td>${qtdFilhos}</td>
                <td class="acoesUsuario">
                    <button onclick='abrirModalVaca(${jsonAtributo(v)})'>✏️</button>
                    <button onclick='excluirVaca(${jsonAtributo(v.id)}, ${jsonAtributo(v.numero)})'>🗑️</button>
                </td>
            </tr>
        `;
    }).join("");
}

async function abrirModalVaca(vacaExistente) {
    vacaEditandoId = vacaExistente ? vacaExistente.id : null;
    document.getElementById("modalVacaTitulo").innerText = vacaEditandoId ? "✏️ Editar Vaca Matriz" : "➕ Nova Vaca Matriz";

    await carregarPastosAdmin();
    let selectPasto = document.getElementById("vacaPastoInput");
    selectPasto.innerHTML = `<option value="">Sem pasto definido</option>` +
        pastosCacheAdmin.filter(p => p.ativo).map(p => `<option value="${p.nome.replace(/"/g, "&quot;")}">${p.nome}</option>`).join("");

    document.getElementById("vacaNumeroInput").value = vacaExistente ? vacaExistente.numero : "";
    document.getElementById("vacaApelidoInput").value = vacaExistente ? (vacaExistente.apelido || "") : "";
    document.getElementById("vacaRacaInput").value = vacaExistente ? (vacaExistente.raca || "") : "";
    document.getElementById("vacaDataNascimentoInput").value = vacaExistente && vacaExistente.dataNascimento ? (extrairDataISO(vacaExistente.dataNascimento) || "") : "";
    selectPasto.value = vacaExistente ? (vacaExistente.pastoNome || "") : "";
    document.getElementById("vacaStatusInput").value = vacaExistente ? vacaExistente.status : "ativa";
    document.getElementById("vacaDataMorteInput").value = vacaExistente && vacaExistente.dataMorte ? (extrairDataISO(vacaExistente.dataMorte) || "") : "";
    document.getElementById("vacaCausaMorteInput").value = vacaExistente ? (vacaExistente.causaMorte || "") : "";
    document.getElementById("vacaObservacoesInput").value = vacaExistente ? (vacaExistente.observacoes || "") : "";
    alternarCamposMorteVaca();

    let erroEl = document.getElementById("vacaErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalVaca").style.display = "flex";
}

function alternarCamposMorteVaca() {
    let status = document.getElementById("vacaStatusInput").value;
    document.getElementById("vacaCamposMorte").style.display = status === "morta" ? "block" : "none";
}

function fecharModalVaca() {
    document.getElementById("modalVaca").style.display = "none";
    vacaEditandoId = null;
}

async function salvarVaca() {
    let erroEl = document.getElementById("vacaErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }
    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let numero = document.getElementById("vacaNumeroInput").value.trim();
        if (!numero) { mostrarErro("Informe o número (brinco) da vaca."); return; }
        let jaExiste = vacasMatrizCacheAdmin.some(v => normalizarNumeroAnimal(v.numero) === normalizarNumeroAnimal(numero) && v.id !== vacaEditandoId);
        if (jaExiste) { mostrarErro(`Já existe uma vaca cadastrada com o número "${numero}".`); return; }
        let status = document.getElementById("vacaStatusInput").value;
        let dataMorteISO = document.getElementById("vacaDataMorteInput").value;
        let dataNascimentoISO = document.getElementById("vacaDataNascimentoInput").value;

        let vaca = {
            id: vacaEditandoId || crypto.randomUUID(),
            numero,
            apelido: document.getElementById("vacaApelidoInput").value.trim() || null,
            raca: document.getElementById("vacaRacaInput").value.trim() || null,
            dataNascimento: dataNascimentoISO ? formatarDataBR(dataNascimentoISO) : null,
            pastoNome: document.getElementById("vacaPastoInput").value || null,
            status,
            dataMorte: status === "morta" && dataMorteISO ? formatarDataBR(dataMorteISO) : null,
            causaMorte: status === "morta" ? (document.getElementById("vacaCausaMorteInput").value.trim() || null) : null,
            observacoes: document.getElementById("vacaObservacoesInput").value.trim() || null
        };

        let resp = await fetch(`${API_URL}/api/vacas-matriz/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ vacas: [vaca] })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar (HTTP ${resp.status}).`); return; }
        if (dados.idsRejeitados && dados.idsRejeitados.includes(vaca.id)) { mostrarErro(`Já existe uma vaca cadastrada com o número "${numero}" (ou o número é inválido).`); return; }

        fecharModalVaca();
        await carregarVacasMatrizAdmin();
        mostrarVacas();
        mostrarResumoVacasMatriz();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function excluirVaca(id, numero) {
    if (!await confirmarModerno(`Excluir a vaca "${numero}" permanentemente? Os nascimentos já registrados dela continuam existindo.`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/vacas-matriz/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await carregarVacasMatrizAdmin();
        mostrarVacas();
        mostrarResumoVacasMatriz();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

// ---------- NASCIMENTOS ----------
async function carregarNascimentosAdmin() {
    let token = obterToken();
    if (!token) return [];
    try {
        let resp = await fetch(`${API_URL}/api/nascimentos`, { headers: { "Authorization": "Bearer " + token } });
        if (!resp.ok) return [];
        nascimentosCacheAdmin = await resp.json();
        return nascimentosCacheAdmin;
    } catch (e) {
        return [];
    }
}

async function abrirTelaNascimentos() {
    await carregarNascimentosAdmin();
    mostrarNascimentos();
}

function mostrarNascimentos() {
    let corpo = document.getElementById("corpoTabelaNascimentos");
    if (!corpo) return;
    let filtro = document.getElementById("nascFiltroStatus");
    let statusFiltro = filtro ? filtro.value : "";
    let lista = statusFiltro ? nascimentosCacheAdmin.filter(n => n.status === statusFiltro) : nascimentosCacheAdmin;

    if (lista.length === 0) {
        corpo.innerHTML = `<tr><td colspan="9">Nenhum nascimento encontrado.</td></tr>`;
        return;
    }

    function textoStatusNascimento(n) {
        if (n.status === "vivo") return { texto: "🐮 Vivo", cor: "#0ca30c" };
        if (n.status === "apartado") return { texto: "✅ Apartado", cor: "#1976d2" };
        return { texto: "⚰️ Morto", cor: "#d03b3b" };
    }

    corpo.innerHTML = lista.map(n => {
        let st = textoStatusNascimento(n);
        let acoes = "";
        if (n.status === "vivo") {
            acoes += `<button onclick='abrirModalEventoNascimento(${jsonAtributo(n.id)}, "apartar")'>✅</button>`;
            acoes += `<button onclick='abrirModalEventoNascimento(${jsonAtributo(n.id)}, "morte")'>⚰️</button>`;
        }
        if (avisoVacinaBrucelose(n)) {
            acoes += `<button onclick='abrirModalEventoNascimento(${jsonAtributo(n.id)}, "vacinar")'>💉</button>`;
        }
        acoes += `<button onclick='excluirNascimento(${jsonAtributo(n.id)}, ${jsonAtributo(n.numeroBezerro)})'>🗑️</button>`;
        let avisos = [avisoApartacaoNascimento(n), avisoVacinaBrucelose(n)].filter(Boolean);
        let avisosHtml = avisos.length
            ? avisos.map(a => `<div style="color:${a.cor};font-size:.85em">${a.texto}</div>`).join("")
            : "—";
        return `
            <tr>
                <td>${n.dataNascimento ? n.dataNascimento.split(",")[0] : "—"}</td>
                <td>${n.numeroBezerro}</td>
                <td>${n.vacaMaeNumero}</td>
                <td>${n.sexo === "macho" ? "Macho" : n.sexo === "femea" ? "Fêmea" : "—"}</td>
                <td>${formatarIdadeAnimal(n.dataNascimento)}</td>
                <td>${escaparHtmlPesagem(n.pastoNome || "—")}</td>
                <td style="color:${st.cor}">${st.texto}</td>
                <td>${avisosHtml}</td>
                <td class="acoesUsuario">${acoes}</td>
            </tr>
        `;
    }).join("");
}

async function abrirModalNascimento() {
    let token = obterToken();
    if (!token) return;

    await Promise.all([carregarVacasMatrizAdmin(), carregarPastosAdmin()]);
    let selectVaca = document.getElementById("nascVacaMaeInput");
    selectVaca.innerHTML = `<option value="">Selecione a vaca mãe</option>` +
        vacasMatrizCacheAdmin.filter(v => v.status === "ativa").map(v => `<option value="${v.numero.replace(/"/g, "&quot;")}">${v.numero}${v.apelido ? " — " + v.apelido : ""}</option>`).join("");
    let selectPasto = document.getElementById("nascPastoInput");
    selectPasto.innerHTML = `<option value="">Sem pasto definido</option>` +
        pastosCacheAdmin.filter(p => p.ativo).map(p => `<option value="${p.nome.replace(/"/g, "&quot;")}">${p.nome}</option>`).join("");

    document.getElementById("nascNumeroBezerroInput").value = "";
    document.getElementById("nascSexoInput").value = "";
    document.getElementById("nascPesoInput").value = "";
    document.getElementById("nascDataInput").value = new Date().toISOString().slice(0, 10);
    let erroEl = document.getElementById("nascErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalNascimento").style.display = "flex";
}

function fecharModalNascimento() {
    document.getElementById("modalNascimento").style.display = "none";
}

async function salvarNascimento() {
    let erroEl = document.getElementById("nascErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }
    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }

        let vacaMaeNumero = document.getElementById("nascVacaMaeInput").value;
        let numeroBezerro = document.getElementById("nascNumeroBezerroInput").value.trim();
        let dataISO = document.getElementById("nascDataInput").value;
        if (!vacaMaeNumero) { mostrarErro("Selecione a vaca mãe."); return; }
        if (!numeroBezerro) { mostrarErro("Informe o número do bezerro."); return; }
        if (!dataISO) { mostrarErro("Informe a data de nascimento."); return; }
        if (nascimentosCacheAdmin.some(n => normalizarNumeroAnimal(n.numeroBezerro) === normalizarNumeroAnimal(numeroBezerro))) { mostrarErro(`Já existe um nascimento cadastrado com o número de bezerro "${numeroBezerro}".`); return; }

        let peso = document.getElementById("nascPesoInput").value.trim();
        let pesoNum = peso ? parseFloat(peso.replace(",", ".")) : null;

        let nascimento = {
            id: crypto.randomUUID(),
            numeroBezerro,
            vacaMaeNumero,
            sexo: document.getElementById("nascSexoInput").value || null,
            pesoNascimento: Number.isFinite(pesoNum) ? pesoNum : null,
            dataNascimento: formatarDataBR(dataISO),
            pastoNome: document.getElementById("nascPastoInput").value || null,
            status: "vivo"
        };

        let resp = await fetch(`${API_URL}/api/nascimentos/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ nascimentos: [nascimento] })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar (HTTP ${resp.status}).`); return; }
        if (dados.idsRejeitados && dados.idsRejeitados.includes(nascimento.id)) { mostrarErro(`Já existe um nascimento cadastrado com o número de bezerro "${numeroBezerro}" (ou algum campo é inválido).`); return; }

        fecharModalNascimento();
        await carregarNascimentosAdmin();
        mostrarNascimentos();
        mostrarResumoVacasMatriz();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

async function excluirNascimento(id, numeroBezerro) {
    if (!await confirmarModerno(`Excluir o registro de nascimento do bezerro "${numeroBezerro}"?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/nascimentos/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { await alertarModerno(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await carregarNascimentosAdmin();
        mostrarNascimentos();
        mostrarResumoVacasMatriz();
    } catch (e) {
        await alertarModerno("Erro de conexão: " + e.message);
    }
}

function abrirModalEventoNascimento(nascimentoId, tipo) {
    eventoNascimentoId = nascimentoId;
    eventoNascimentoTipo = tipo;
    let nascimento = nascimentosCacheAdmin.find(n => n.id === nascimentoId);
    if (!nascimento) return;

    let titulo = document.getElementById("modalEventoNascimentoTitulo");
    let info = document.getElementById("eventoNascimentoInfo");
    let valorExtra = document.getElementById("eventoValorExtraInput");
    if (tipo === "apartar") {
        titulo.innerText = "✅ Registrar Apartação";
        info.innerText = `Bezerro ${nascimento.numeroBezerro} (mãe ${nascimento.vacaMaeNumero})`;
        valorExtra.placeholder = "Peso na apartação (kg, opcional)";
        valorExtra.style.display = "block";
    } else if (tipo === "vacinar") {
        titulo.innerText = "💉 Registrar Vacinação (Brucelose)";
        info.innerText = `Bezerra ${nascimento.numeroBezerro} (mãe ${nascimento.vacaMaeNumero})`;
        valorExtra.style.display = "none";
    } else {
        titulo.innerText = "⚰️ Registrar Morte";
        info.innerText = `Bezerro ${nascimento.numeroBezerro} (mãe ${nascimento.vacaMaeNumero})`;
        valorExtra.placeholder = "Causa da morte (opcional)";
        valorExtra.style.display = "block";
    }
    valorExtra.value = "";
    document.getElementById("eventoDataInput").value = new Date().toISOString().slice(0, 10);
    let erroEl = document.getElementById("eventoNascimentoErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    document.getElementById("modalEventoNascimento").style.display = "flex";
}

function fecharModalEventoNascimento() {
    document.getElementById("modalEventoNascimento").style.display = "none";
    eventoNascimentoId = null;
    eventoNascimentoTipo = null;
}

async function confirmarEventoNascimento() {
    let erroEl = document.getElementById("eventoNascimentoErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }
    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }
        if (!eventoNascimentoId) return;

        let nascimento = nascimentosCacheAdmin.find(n => n.id === eventoNascimentoId);
        if (!nascimento) { mostrarErro("Nascimento não encontrado."); return; }

        let dataISO = document.getElementById("eventoDataInput").value;
        if (!dataISO) { mostrarErro("Informe a data."); return; }
        let dataFormatada = formatarDataBR(dataISO);
        let valorExtra = document.getElementById("eventoValorExtraInput").value.trim();

        let atualizado = { ...nascimento };
        if (eventoNascimentoTipo === "apartar") {
            atualizado.status = "apartado";
            atualizado.dataApartacao = dataFormatada;
            let pesoNum = valorExtra ? parseFloat(valorExtra.replace(",", ".")) : null;
            atualizado.pesoApartacao = Number.isFinite(pesoNum) ? pesoNum : null;
        } else if (eventoNascimentoTipo === "vacinar") {
            atualizado.vacinadaBrucelose = true;
            atualizado.dataVacinacaoBrucelose = dataFormatada;
        } else {
            atualizado.status = "morto";
            atualizado.dataMorte = dataFormatada;
            atualizado.causaMorte = valorExtra || null;
        }

        let resp = await fetch(`${API_URL}/api/nascimentos/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ nascimentos: [atualizado] })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao registrar (HTTP ${resp.status}).`); return; }

        fecharModalEventoNascimento();
        await carregarNascimentosAdmin();
        mostrarNascimentos();
        mostrarResumoVacasMatriz();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}


// ========================================
// CADASTRO DE FAZENDA (tela de login) E PAINEL "FAZENDAS" (dono do sistema)
// ========================================
function abrirCadastroFazenda() {
    let erro = document.getElementById("cadFazendaErro");
    if (erro) erro.style.display = "none";
    trocarTela("telaCadastroFazenda");
}

async function enviarCadastroFazenda() {
    let valor = id => document.getElementById(id).value;
    let erroEl = document.getElementById("cadFazendaErro");
    let botao = document.getElementById("btnCadastrarFazenda");
    function mostrarErro(msg) { erroEl.innerText = msg; erroEl.style.display = "block"; }

    let corpo = {
        nomeFazenda: valor("cadFazendaNome").trim(),
        nome: valor("cadFazendaResponsavel").trim(),
        usuario: valor("cadFazendaUsuario").trim(),
        senha: valor("cadFazendaSenha"),
        codigoConvite: valor("cadFazendaConvite").trim()
    };
    if (!corpo.nomeFazenda || !corpo.nome || !corpo.usuario || !corpo.senha || !corpo.codigoConvite) return mostrarErro("Preencha todos os campos.");
    if (/\s/.test(corpo.usuario)) return mostrarErro("O usuário não pode ter espaços.");
    if (corpo.senha.length < 6) return mostrarErro("A senha precisa ter pelo menos 6 caracteres.");
    if (corpo.senha !== valor("cadFazendaSenha2")) return mostrarErro("As senhas não são iguais.");

    erroEl.style.display = "none";
    botao.disabled = true;
    botao.innerText = "Criando a fazenda...";
    try {
        let resp = await fetch(`${API_URL}/api/auth/cadastrar-fazenda`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo)
        });
        let dados = await resp.json();
        if (!resp.ok) return mostrarErro(dados.erro || "Não foi possível cadastrar.");

        // mesmo caminho de um login normal (limpa dados locais de outra
        // fazenda, guarda sessão/permissões e abre o painel)
        prepararDadosLocaisParaFazenda(dados.token);
        localStorage.setItem("sessionToken", dados.token);
        localStorage.setItem("usuarioNome", dados.nome);
        localStorage.setItem("usuarioPapel", dados.papel);
        localStorage.setItem("permTipoPesagem", dados.permissaoTipoPesagem || "ambos");
        localStorage.setItem("permDashboard", dados.permissaoDashboard || "geral");
        localStorage.setItem("permRelatorios", dados.permissaoRelatorios || "geral");
        localStorage.setItem("valorMaximoCompra", "");
        localStorage.setItem("permAlmoxarifado", dados.permissaoAlmoxarifado ? "1" : "");
        localStorage.setItem("permVacasMatriz", dados.permissaoVacasMatriz ? "1" : "");
        localStorage.setItem("permEditarNascimentos", dados.permissaoEditarNascimentos ? "1" : "");
        guardarDadosFazenda(dados);
        ["cadFazendaNome", "cadFazendaResponsavel", "cadFazendaUsuario", "cadFazendaSenha", "cadFazendaSenha2", "cadFazendaConvite"].forEach(id => { document.getElementById(id).value = ""; });
        irParaTelaPrincipal();
        atualizarBotaoLogin();
        aplicarRestricoesUsuario();
        sincronizarAgora();
        alertarModerno(`A fazenda "${dados.fazenda.nome}" foi criada. Agora cadastre os lotes e, em Usuários, os logins dos seus operadores para o celular.`, { titulo: "✅ Bem-vindo ao PesoCerto" });
    } catch (e) {
        mostrarErro("Erro de conexão.");
    } finally {
        botao.disabled = false;
        botao.innerText = "Criar fazenda";
    }
}

async function requisicaoSistema(metodo, rota, corpo) {
    let resp = await fetch(`${API_URL}${rota}`, {
        method: metodo,
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + obterToken() },
        body: corpo ? JSON.stringify(corpo) : undefined
    });
    let dados = null;
    try { dados = await resp.json(); } catch (e) {}
    if (!resp.ok) throw new Error((dados && dados.erro) || "Erro na requisição.");
    return dados;
}

function formatarDataHoraCurta(valor) {
    if (!valor) return "—";
    let d = new Date(valor);
    return isNaN(d) ? "—" : d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

async function carregarFazendasSistema() {
    let corpo = document.getElementById("corpoTabelaFazendas");
    if (!corpo) return;
    corpo.innerHTML = `<tr><td colspan="7">Carregando...</td></tr>`;
    try {
        let [fazendas, convite] = await Promise.all([
            requisicaoSistema("GET", "/api/sistema/fazendas"),
            requisicaoSistema("GET", "/api/sistema/convite")
        ]);
        document.getElementById("codigoConviteAtual").innerText = convite.codigo || "—";
        corpo.innerHTML = fazendas.map(f => `
            <tr>
                <td><b>${escaparHtmlPesagem(f.nome)}</b>${f.principal ? ' <span class="seloFazendaPrincipal">sua fazenda</span>' : ""}</td>
                <td>${formatarDataHoraCurta(f.criadoEm)}</td>
                <td>${f.usuarios}</td>
                <td>${f.pesagens}</td>
                <td>${formatarDataHoraCurta(f.ultimoAcesso)}</td>
                <td>${f.ativo ? "✅ Ativa" : "🚫 Bloqueada"}</td>
                <td class="acoesUsuario">
                    <button title="Lotes dessa fazenda (cadastrar / ativar / desativar)" onclick='abrirLotesFazenda(${jsonAtributo(f.id)}, ${jsonAtributo(f.nome)})'>🏷️</button>
                    <button title="Ver compras, vendas e relatórios" onclick='verDadosFazenda(${jsonAtributo(f.id)}, ${jsonAtributo(f.nome)})'><svg class="iconeVerDados" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
                    <button title="Renomear" onclick='renomearFazendaSistema(${jsonAtributo(f.id)}, ${jsonAtributo(f.nome)})'>✏️</button>
                    ${f.principal ? "" : `<button title="${f.ativo ? "Bloquear" : "Desbloquear"}" onclick='alternarBloqueioFazenda(${jsonAtributo(f.id)}, ${jsonAtributo(f.nome)}, ${!f.ativo})'>${f.ativo ? "🚫" : "✅"}</button>`}
                </td>
            </tr>
        `).join("");
    } catch (e) {
        corpo.innerHTML = `<tr><td colspan="7">${escaparHtmlPesagem(e.message)}</td></tr>`;
    }
}

async function copiarCodigoConvite() {
    let codigo = document.getElementById("codigoConviteAtual").innerText;
    try {
        await navigator.clipboard.writeText(codigo);
        alertarModerno("Código copiado: " + codigo, { titulo: "📋 Copiado" });
    } catch (e) {
        alertarModerno("Código de convite: " + codigo, { titulo: "Código de convite" });
    }
}

async function trocarCodigoConvite() {
    let novo = prompt("Novo código de convite (de 4 a 40 caracteres). O código antigo deixa de funcionar na hora:");
    if (novo === null) return;
    try {
        let r = await requisicaoSistema("PUT", "/api/sistema/convite", { codigo: novo.trim() });
        document.getElementById("codigoConviteAtual").innerText = r.codigo;
    } catch (e) {
        alertarModerno(e.message, { titulo: "⚠️ Atenção" });
    }
}

async function alternarBloqueioFazenda(id, nome, ativar) {
    let ok = await confirmarModerno(ativar
        ? `Desbloquear a fazenda "${nome}"? Os usuários dela voltam a conseguir entrar.`
        : `Bloquear a fazenda "${nome}"? Ninguém dela consegue mais entrar nem sincronizar até você desbloquear. Os dados NÃO são apagados.`,
        { titulo: ativar ? "✅ Desbloquear fazenda" : "🚫 Bloquear fazenda", textoConfirmar: ativar ? "Desbloquear" : "Bloquear" });
    if (!ok) return;
    try {
        await requisicaoSistema("PUT", "/api/sistema/fazendas/" + id, { ativo: ativar });
        carregarFazendasSistema();
    } catch (e) {
        alertarModerno(e.message, { titulo: "⚠️ Atenção" });
    }
}

async function renomearFazendaSistema(id, nomeAtual) {
    let novo = prompt("Nome da fazenda:", nomeAtual);
    if (novo === null || !novo.trim() || novo.trim() === nomeAtual) return;
    try {
        await requisicaoSistema("PUT", "/api/sistema/fazendas/" + id, { nome: novo.trim() });
        if (id === localStorage.getItem("fazendaId")) guardarDadosFazenda({ fazenda: { id, nome: novo.trim() } });
        carregarFazendasSistema();
    } catch (e) {
        alertarModerno(e.message, { titulo: "⚠️ Atenção" });
    }
}

function alternarVerSenha(idCampo, botao) {
    let campo = document.getElementById(idCampo);
    if (!campo) return;
    let mostrar = campo.type === "password";
    campo.type = mostrar ? "text" : "password";
    botao.classList.toggle("ativo", mostrar);
    botao.title = mostrar ? "Ocultar senha" : "Mostrar senha";
    botao.setAttribute("aria-label", botao.title);
}

// ========================================
// PAINEL FAZENDAS: consultar compras/vendas/relatórios de uma fazenda
// (só leitura, só o dono do sistema)
// ========================================
let dadosFazendaAberta = { nome: "", pesagens: [] };

async function verDadosFazenda(id, nome) {
    let painel = document.getElementById("fazendaDadosPainel");
    let corpo = document.getElementById("corpoTabelaDadosFazenda");
    document.getElementById("fazendaDadosTitulo").innerText = "📊 " + nome;
    document.getElementById("fazendaDadosResumo").innerHTML = "";
    corpo.innerHTML = `<tr><td colspan="9">Carregando...</td></tr>`;
    painel.style.display = "block";
    painel.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
        let pesagens = await requisicaoSistema("GET", "/api/sistema/fazendas/" + id + "/pesagens");
        dadosFazendaAberta = { nome, pesagens };
        let lotes = [...new Set(pesagens.map(p => p.descricao || "Sem descrição"))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        let selLote = document.getElementById("fazendaDadosFiltroLote");
        selLote.innerHTML = `<option value="">Todos os lotes</option>` + lotes.map(l => `<option value="${escaparHtmlPesagem(l)}">${escaparHtmlPesagem(l)}</option>`).join("");
        document.getElementById("fazendaDadosFiltroTipo").value = "";
        renderizarDadosFazenda();
    } catch (e) {
        corpo.innerHTML = `<tr><td colspan="9">${escaparHtmlPesagem(e.message)}</td></tr>`;
    }
}

function fecharDadosFazenda() {
    document.getElementById("fazendaDadosPainel").style.display = "none";
    dadosFazendaAberta = { nome: "", pesagens: [] };
}

function renderizarDadosFazenda() {
    let tipo = document.getElementById("fazendaDadosFiltroTipo").value;
    let lote = document.getElementById("fazendaDadosFiltroLote").value;
    let lista = dadosFazendaAberta.pesagens.filter(p =>
        (!tipo || (p.tipo || "venda") === tipo) && (!lote || (p.descricao || "Sem descrição") === lote));

    // mesma conta de valores do resto do sistema (calcularDadosCompletos)
    let tot = { compra: { n: 0, animais: 0, kg: 0, rs: 0 }, venda: { n: 0, animais: 0, kg: 0, rs: 0 } };
    let linhas = lista.map(p => {
        let d = calcularDadosCompletos(p);
        let t = tot[(p.tipo || "venda") === "compra" ? "compra" : "venda"];
        t.n++; t.animais += d.totalAnimais; t.kg += d.totalKg; t.rs += d.totalRS;
        return { p, d };
    });

    let cartao = (classe, titulo, t) => `
        <div class="fazendaResumoCartao ${classe}">
            <span>${titulo}</span>
            <b>R$ ${formatarMoeda(t.rs)}</b>
            <small>${t.n} pesage${t.n === 1 ? "m" : "ns"} · ${t.animais} animais · ${formatarPeso(Math.round(t.kg * 10) / 10)} kg</small>
        </div>`;
    let saldo = tot.venda.rs - tot.compra.rs;
    document.getElementById("fazendaDadosResumo").innerHTML =
        cartao("fazendaResumoCompra", "🛒 Compras", tot.compra) +
        cartao("fazendaResumoVenda", "💰 Vendas", tot.venda) +
        `<div class="fazendaResumoCartao ${saldo >= 0 ? "fazendaResumoPositivo" : "fazendaResumoNegativo"}">
            <span>⚖️ Vendas − Compras</span>
            <b>${saldo >= 0 ? "▲" : "▼"} R$ ${formatarMoeda(Math.abs(saldo))}</b>
            <small>só pesagens (sem insumos, caixa e despesas)</small>
        </div>`;

    let corpo = document.getElementById("corpoTabelaDadosFazenda");
    if (linhas.length === 0) {
        corpo.innerHTML = `<tr><td colspan="9">Nenhuma pesagem ${dadosFazendaAberta.pesagens.length ? "com esse filtro" : "registrada ainda"}.</td></tr>`;
        return;
    }
    corpo.innerHTML = linhas.map(({ p, d }, i) => {
        let ehCompra = (p.tipo || "venda") === "compra";
        let pesos = (p.pesos || []).map((x, k) => `<span>#${k + 1} ${formatarPeso(x.peso)} kg · R$ ${formatarMoeda(d.valorDoItem(x.peso || 0, x))}${x.obs ? " (" + escaparHtmlPesagem(x.obs) + ")" : ""}</span>`).join("");
        return `
            <tr class="linhaPesagemFazenda" onclick="alternarPesosPesagemFazenda(${i})">
                <td>${p.numero || "—"}</td>
                <td>${escaparHtmlPesagem(p.data || "")}</td>
                <td><span class="seloTipoPesagem ${ehCompra ? "seloCompra" : "seloVenda"}">${ehCompra ? "Compra" : "Venda"}</span></td>
                <td>${escaparHtmlPesagem(p.vendedor || "—")}</td>
                <td>${escaparHtmlPesagem(p.descricao || "Sem descrição")}</td>
                <td>${d.totalAnimais}</td>
                <td>${formatarPeso(Math.round(d.totalKg * 10) / 10)}</td>
                <td><b>R$ ${formatarMoeda(d.totalRS)}</b></td>
                <td><button class="btnRelatorioFazenda" onclick='event.stopPropagation(); abrirRelatorioFazenda(${jsonAtributo(p.id)})'>📄 Relatório</button></td>
            </tr>
            <tr class="linhaPesosFazenda" id="pesosPesagemFazenda${i}" style="display:none">
                <td colspan="9"><div class="pesosPesagemFazenda">${pesos || "Sem pesos."}</div></td>
            </tr>`;
    }).join("");
}

function alternarPesosPesagemFazenda(i) {
    let linha = document.getElementById("pesosPesagemFazenda" + i);
    if (linha) linha.style.display = linha.style.display === "none" ? "table-row" : "none";
}

// relatório completo de uma pesagem de outra fazenda -- o MESMO texto da
// mensagem de WhatsApp do app (montarMensagemWhatsApp), inclusive juntando
// as pesagens da mesma sessão (vários critérios) num relatório só
let textoRelatorioFazendaAberto = "";

function abrirRelatorioFazenda(idPesagem) {
    let todas = dadosFazendaAberta.pesagens;
    let r = todas.find(p => p.id === idPesagem);
    if (!r) return;
    let registros = r.sessaoId ? todas.filter(p => p.sessaoId === r.sessaoId) : [r];
    registros.sort((a, b) => (a.numero || 0) - (b.numero || 0));
    textoRelatorioFazendaAberto = montarMensagemWhatsApp(registros);
    // *negrito* do WhatsApp vira negrito de verdade na tela
    let html = escaparHtmlPesagem(textoRelatorioFazendaAberto).replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
    document.getElementById("modalRelatorioFazendaTitulo").innerText =
        dadosFazendaAberta.nome + (r.numero ? " — Pesagem nº " + r.numero : "");
    document.getElementById("modalRelatorioFazendaTexto").innerHTML = html;
    document.getElementById("btnCopiarRelatorioFazenda").innerText = "📋 Copiar";
    document.getElementById("modalRelatorioFazenda").style.display = "flex";
}

function fecharRelatorioFazenda() {
    document.getElementById("modalRelatorioFazenda").style.display = "none";
}

async function copiarRelatorioFazenda() {
    let botao = document.getElementById("btnCopiarRelatorioFazenda");
    try {
        await navigator.clipboard.writeText(textoRelatorioFazendaAberto);
        botao.innerText = "✅ Copiado";
    } catch (e) {
        botao.innerText = "Não foi possível copiar";
    }
}

function enviarRelatorioFazendaWhatsApp() {
    window.open("https://wa.me/?text=" + encodeURIComponent(textoRelatorioFazendaAberto), "_blank");
}

// menu lateral vira gaveta no celular (ver admin.css, @media max-width 900px)
function alternarMenuCelular() {
    document.body.classList.toggle("menuCelularAberto");
}
function fecharMenuCelular() {
    document.body.classList.remove("menuCelularAberto");
}

// ========================================
// PAINEL FAZENDAS: lotes de uma fazenda (o dono cadastra pra ela)
// ========================================
let fazendaLotesAberta = { id: null, nome: "" };

async function abrirLotesFazenda(id, nome) {
    fazendaLotesAberta = { id, nome };
    document.getElementById("fazendaLotesTitulo").innerText = "🏷️ Lotes · " + nome;
    document.getElementById("fazendaLoteNovoNome").value = "";
    document.getElementById("fazendaLoteErro").style.display = "none";
    let painel = document.getElementById("fazendaLotesPainel");
    painel.style.display = "block";
    painel.scrollIntoView({ behavior: "smooth", block: "start" });
    await carregarLotesFazendaDono();
    document.getElementById("fazendaLoteNovoNome").focus();
}

function fecharLotesFazenda() {
    document.getElementById("fazendaLotesPainel").style.display = "none";
    fazendaLotesAberta = { id: null, nome: "" };
}

async function carregarLotesFazendaDono() {
    let corpo = document.getElementById("corpoTabelaLotesFazenda");
    corpo.innerHTML = `<tr><td colspan="4">Carregando...</td></tr>`;
    try {
        let lotes = await requisicaoSistema("GET", "/api/sistema/fazendas/" + fazendaLotesAberta.id + "/lotes");
        if (lotes.length === 0) {
            corpo.innerHTML = `<tr><td colspan="4">Essa fazenda ainda não tem nenhum lote.</td></tr>`;
            return;
        }
        corpo.innerHTML = lotes.map(l => `
            <tr>
                <td><b>${escaparHtmlPesagem(l.nome)}</b></td>
                <td>${typeof l.saldo === "number" ? l.saldo : "—"}</td>
                <td>${l.ativo ? "✅ Ativo" : "🚫 Inativo"}</td>
                <td class="acoesUsuario"><button title="${l.ativo ? "Desativar (some das listas)" : "Ativar"}" onclick='alternarLoteFazendaDono(${jsonAtributo(l.id)}, ${!l.ativo})'>${l.ativo ? "🚫" : "✅"}</button></td>
            </tr>
        `).join("");
    } catch (e) {
        corpo.innerHTML = `<tr><td colspan="4">${escaparHtmlPesagem(e.message)}</td></tr>`;
    }
}

async function adicionarLoteFazenda() {
    let campo = document.getElementById("fazendaLoteNovoNome");
    let erro = document.getElementById("fazendaLoteErro");
    let nome = campo.value.trim();
    erro.style.display = "none";
    if (!nome) { erro.innerText = "Digite o nome do lote."; erro.style.display = "block"; return; }
    try {
        await requisicaoSistema("POST", "/api/sistema/fazendas/" + fazendaLotesAberta.id + "/lotes", { nome });
        campo.value = "";
        await carregarLotesFazendaDono();
        campo.focus();
    } catch (e) {
        erro.innerText = e.message;
        erro.style.display = "block";
    }
}

async function alternarLoteFazendaDono(loteId, ativar) {
    try {
        await requisicaoSistema("PUT", "/api/sistema/fazendas/" + fazendaLotesAberta.id + "/lotes/" + loteId, { ativo: ativar });
        await carregarLotesFazendaDono();
    } catch (e) {
        alertarModerno(e.message, { titulo: "⚠️ Atenção" });
    }
}
