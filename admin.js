(function () {
    let original = window.trocarTela;
    window.trocarTela = function (id) {
        original(id);
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
// GERENCIAMENTO DE USUÁRIOS
// ========================================
let usuarioEditandoId = null;

async function carregarUsuarios() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaUsuarios");
    if (!token || !corpo) return;

    try {
        let resp = await fetch(`${API_URL}/api/usuarios`, {
            headers: { "Authorization": "Bearer " + token }
        });
        if (!resp.ok) {
            corpo.innerHTML = `<tr><td colspan="5">Acesso restrito a administradores, ou sessão expirada.</td></tr>`;
            return;
        }
        let usuarios = await resp.json();
        corpo.innerHTML = usuarios.map(u => `
            <tr>
                <td>${u.nome}</td>
                <td>${u.usuario}</td>
                <td>${u.papel === "admin" ? "Administrador" : "Operador"}</td>
                <td>${u.papel === "admin" ? "—" : `
                    <span class="tagPermissao">${rotuloPermTipo(u.permissaoTipoPesagem)}</span>
                    <span class="tagPermissao">Dash: ${rotuloPermEscopo(u.permissaoDashboard)}</span>
                    <span class="tagPermissao">Rel: ${rotuloPermEscopo(u.permissaoRelatorios)}</span>
                    ${u.valorMaximoCompra !== null && u.valorMaximoCompra !== undefined ? `<span class="tagPermissao">Máx compra: ${formatarValorReais(u.valorMaximoCompra)}</span>` : ""}
                `}</td>
                <td>${u.ativo ? "✅ Ativo" : "🚫 Inativo"}</td>
                <td class="acoesUsuario">
                    <button onclick='abrirModalUsuario(${JSON.stringify(u)})'>✏️</button>
                    <button onclick='alternarAtivoUsuario(${JSON.stringify(u.id)}, ${!u.ativo})'>${u.ativo ? "🚫" : "✅"}</button>
                    <button onclick='excluirUsuario(${JSON.stringify(u.id)}, ${JSON.stringify(u.nome)})'>🗑️</button>
                </td>
            </tr>
        `).join("");
    } catch (e) {
        corpo.innerHTML = `<tr><td colspan="6">Erro ao carregar usuários.</td></tr>`;
    }
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
    return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

        if (!nome || !usuario || (!usuarioEditandoId && !senha)) {
            mostrarErro("Preencha todos os campos.");
            return;
        }

        let resp;
        if (usuarioEditandoId) {
            let corpo = { nome, papel, permissaoTipoPesagem, permissaoDashboard, permissaoRelatorios, valorMaximoCompra };
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
                body: JSON.stringify({ nome, usuario, senha, papel, permissaoTipoPesagem, permissaoDashboard, permissaoRelatorios, valorMaximoCompra })
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
    if (!confirm(novoAtivo ? "Reativar este usuário?" : "Desativar este usuário? Ele não conseguirá mais entrar.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/usuarios/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert(dados.erro || `Erro ao atualizar usuário (HTTP ${resp.status}).`);
            return;
        }
        carregarUsuarios();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

async function excluirUsuario(id, nome) {
    if (!confirm(`Excluir o usuário "${nome}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/usuarios/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert(dados.erro || `Erro ao excluir usuário (HTTP ${resp.status}).`);
            return;
        }
        carregarUsuarios();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}
