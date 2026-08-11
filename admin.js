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
                    ${u.permissaoAlmoxarifado ? `<span class="tagPermissao">📦 Almoxarifado</span>` : ""}
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

        if (!nome || !usuario || (!usuarioEditandoId && !senha)) {
            mostrarErro("Preencha todos os campos.");
            return;
        }

        let resp;
        if (usuarioEditandoId) {
            let corpo = { nome, papel, permissaoTipoPesagem, permissaoDashboard, permissaoRelatorios, valorMaximoCompra, permissaoAlmoxarifado };
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
                body: JSON.stringify({ nome, usuario, senha, papel, permissaoTipoPesagem, permissaoDashboard, permissaoRelatorios, valorMaximoCompra, permissaoAlmoxarifado })
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

// ========================================
// GERENCIAMENTO DE LOTES
// ========================================
let loteEditandoId = null;

async function carregarLotes() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaLotes");
    if (!token || !corpo) return;

    try {
        let resp = await fetch(`${API_URL}/api/lotes`, {
            headers: { "Authorization": "Bearer " + token }
        });
        if (!resp.ok) {
            corpo.innerHTML = `<tr><td colspan="3">Sessão expirada ou sem acesso.</td></tr>`;
            return;
        }
        let lotes = await resp.json();
        if (lotes.length === 0) {
            corpo.innerHTML = `<tr><td colspan="3">Nenhum lote cadastrado ainda.</td></tr>`;
            return;
        }
        corpo.innerHTML = lotes.map(l => `
            <tr>
                <td>${l.nome}</td>
                <td>${l.ativo ? "✅ Ativo" : "🚫 Inativo"}</td>
                <td class="acoesUsuario">
                    <button onclick='abrirModalLote(${JSON.stringify(l)})'>✏️</button>
                    <button onclick='alternarAtivoLote(${JSON.stringify(l.id)}, ${!l.ativo})'>${l.ativo ? "🚫" : "✅"}</button>
                    <button onclick='excluirLote(${JSON.stringify(l.id)}, ${JSON.stringify(l.nome)})'>🗑️</button>
                </td>
            </tr>
        `).join("");
    } catch (e) {
        corpo.innerHTML = `<tr><td colspan="3">Erro ao carregar lotes.</td></tr>`;
    }
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
    if (!confirm(novoAtivo ? "Reativar este lote?" : "Desativar este lote? Ele deixa de aparecer na lista do celular.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/lotes/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert(dados.erro || `Erro ao atualizar lote (HTTP ${resp.status}).`);
            return;
        }
        carregarLotes();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

async function excluirLote(id, nome) {
    if (!confirm(`Excluir o lote "${nome}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/lotes/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert(dados.erro || `Erro ao excluir lote (HTTP ${resp.status}).`);
            return;
        }
        carregarLotes();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
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
                <button onclick='alternarAtivoDepartamento(${JSON.stringify(d.id)}, ${!d.ativo})'>${d.ativo ? "🚫" : "✅"}</button>
                <button onclick='excluirDepartamento(${JSON.stringify(d.id)}, ${JSON.stringify(d.nome)})'>🗑️</button>
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
        if (!resp.ok) { alert(dados.erro || `Erro ao atualizar departamento (HTTP ${resp.status}).`); return; }
        await carregarDepartamentosModal();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

async function excluirDepartamento(id, nome) {
    if (!confirm(`Excluir o departamento "${nome}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/departamentos/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir departamento (HTTP ${resp.status}).`); return; }
        await carregarDepartamentosModal();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
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
            <td>${p.descricao}</td>
            <td>${p.codigoBarra || "—"}</td>
            <td>${p.departamentoNome || "—"}</td>
            <td>${p.unidade}</td>
            <td>${formatarPeso(p.saldoAtual)}</td>
            <td>R$ ${formatarMoeda(p.custoMedioUnitario)}</td>
            <td>${p.ativo ? "✅ Ativo" : "🚫 Inativo"}</td>
            <td class="acoesUsuario">
                <button onclick='abrirModalProduto(${JSON.stringify(p)})'>✏️</button>
                <button onclick='alternarAtivoProduto(${JSON.stringify(p.id)}, ${!p.ativo})'>${p.ativo ? "🚫" : "✅"}</button>
                <button onclick='excluirProduto(${JSON.stringify(p.id)}, ${JSON.stringify(p.descricao)})'>🗑️</button>
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
    if (!confirm(novoAtivo ? "Reativar este produto?" : "Desativar este produto? Ele deixa de aparecer pra seleção de estoque/saída.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/produtos/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ ativo: novoAtivo })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao atualizar produto (HTTP ${resp.status}).`); return; }
        carregarProdutos();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

async function excluirProduto(id, descricao) {
    if (!confirm(`Excluir o produto "${descricao}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/produtos/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir produto (HTTP ${resp.status}).`); return; }
        carregarProdutos();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

// ========================================
// ALMOXARIFADO — ESTOQUE (ENTRADAS)
// ========================================
async function carregarEstoque() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaEstoqueSaldo");
    if (!token || !corpo) return;
    await carregarProdutosAdmin();
    let ativos = produtosCacheAdmin.filter(p => p.ativo);
    if (ativos.length === 0) {
        corpo.innerHTML = `<tr><td colspan="3">Nenhum produto ativo cadastrado ainda.</td></tr>`;
        return;
    }
    corpo.innerHTML = ativos.map(p => `
        <tr>
            <td>${p.descricao}</td>
            <td>${formatarPeso(p.saldoAtual)} ${p.unidade}</td>
            <td>R$ ${formatarMoeda(p.custoMedioUnitario)}</td>
        </tr>
    `).join("");
}

async function abrirModalEstoqueEntrada() {
    await carregarProdutosAdmin();
    let select = document.getElementById("entradaProdutoInput");
    select.innerHTML = `<option value="">Selecione o produto</option>` +
        produtosCacheAdmin.filter(p => p.ativo).map(p => `<option value="${p.id}">${p.descricao}</option>`).join("");
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
        produtosCacheAdmin.filter(p => p.ativo).map(p => `<option value="${p.id}">${p.descricao}</option>`).join("");

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
            <td>${s.loteNome}</td>
            <td>${formatarPeso(s.quantidade)}</td>
            <td>R$ ${formatarMoeda(s.valorTotal)}</td>
            <td>${s.criadoPor || "—"}</td>
            <td class="acoesUsuario"><button onclick='excluirEstoqueSaida(${JSON.stringify(s.id)})'>🗑️</button></td>
        </tr>
    `).join("");
}

async function excluirEstoqueSaida(id) {
    if (!confirm("Excluir esta saída? O estoque do produto volta a ficar disponível.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/estoque-saidas/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir saída (HTTP ${resp.status}).`); return; }
        await carregarProdutosAdmin();
        carregarHistoricoSaidas();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

// ========================================
// ALMOXARIFADO — CUSTO POR LOTE
// ========================================
async function mostrarCustoPorLote() {
    let token = obterToken();
    let corpo = document.getElementById("corpoTabelaCustoLote");
    if (!token || !corpo) return;

    await Promise.all([carregarEstoqueSaidasAdmin(), carregarCaixaLancamentosAdmin()]);

    // agrega compra/venda por nome de lote a partir das pesagens já sincronizadas
    // (a variável "relatorios" é global, vem de app.js) e soma as saídas de estoque
    // de cada lote — sem mexer nos registros originais de pesagem.
    let porLote = {};
    function grupoDoLote(nome) {
        if (!porLote[nome]) porLote[nome] = { comprados: 0, vendidos: 0, custoCompra: 0, custoInsumos: 0, receitaVenda: 0 };
        return porLote[nome];
    }

    relatorios.forEach(r => {
        let nomeLote = r.descricao || "Sem descrição";
        let grupo = grupoDoLote(nomeLote);
        let d = calcularDadosCompletos(r);
        if ((r.tipo || "venda") === "compra") {
            grupo.comprados += d.totalAnimais;
            grupo.custoCompra += d.totalRS;
        } else {
            grupo.vendidos += d.totalAnimais;
            grupo.receitaVenda += d.totalRS;
        }
    });

    estoqueSaidasCacheAdmin.forEach(s => {
        let grupo = grupoDoLote(s.loteNome);
        grupo.custoInsumos += s.valorTotal;
    });

    // lançamentos avulsos do Fluxo de Caixa marcados com um lote específico
    // (frete, cirurgia etc.) — despesa entra junto com o custo de insumos,
    // receita entra junto com a receita de vendas. Lançamentos sem lote
    // marcado (ex: salário do funcionário) não afetam nenhum lote.
    caixaLancamentosCacheAdmin.forEach(l => {
        if (!l.loteNome) return;
        let grupo = grupoDoLote(l.loteNome);
        if (l.tipo === "saida") grupo.custoInsumos += l.valor;
        else grupo.receitaVenda += l.valor;
    });

    let nomesLotes = Object.keys(porLote).sort();
    if (nomesLotes.length === 0) {
        corpo.innerHTML = `<tr><td colspan="7">Nenhum dado de lote disponível ainda.</td></tr>`;
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
        return { texto: "R$ " + formatarMoeda(valor), cor: "#0b0b0b" };
    }

    corpo.innerHTML = nomesLotes.map(nome => {
        let g = porLote[nome];
        let headcount = g.comprados - g.vendidos;
        let gastoTotal = g.custoCompra + g.custoInsumos;
        let custoRestante = gastoTotal - g.receitaVenda;
        let custoMedio = headcount > 0 ? custoRestante / headcount : 0;
        let restanteFmt = formatarValorPossivelmenteNegativo(custoRestante, headcount);
        let medioFmt = formatarValorPossivelmenteNegativo(custoMedio, headcount);
        return `
            <tr>
                <td>${nome}</td>
                <td>${headcount}</td>
                <td>R$ ${formatarMoeda(g.custoCompra)}</td>
                <td>R$ ${formatarMoeda(g.custoInsumos)}</td>
                <td>R$ ${formatarMoeda(g.receitaVenda)}</td>
                <td style="color:${restanteFmt.cor}">${restanteFmt.texto}</td>
                <td style="color:${headcount > 0 ? medioFmt.cor : '#0b0b0b'}">${headcount > 0 ? medioFmt.texto : "—"}</td>
            </tr>
        `;
    }).join("");
}

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
        carregarSaldoInicial()
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

    let porLote = {};
    function grupoDoLote(nome) {
        if (!porLote[nome]) porLote[nome] = { comprados: 0, vendidos: 0, custoCompra: 0, custoInsumos: 0 };
        return porLote[nome];
    }

    relatorios.forEach(r => {
        if (!dentroDoPeriodo(r.data)) return;
        let nomeLote = r.descricao || "Sem descrição";
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
        if (!dentroDoPeriodo(s.data)) return;
        grupoDoLote(s.loteNome).custoInsumos += s.valorTotal;
    });

    caixaLancamentosCacheAdmin.forEach(l => {
        if (!l.loteNome || !dentroDoPeriodo(l.data)) return;
        let grupo = grupoDoLote(l.loteNome);
        // mesmo tratamento do Custo por Lote: despesa avulsa do lote soma no
        // custo, receita avulsa do lote (ex: venda de esterco) abate — sem
        // isso ela aparecia só no Custo por Lote e "sumia" do Resultado
        // Mensal/Patrimônio, dando números diferentes em cada relatório.
        if (l.tipo === "saida") grupo.custoInsumos += l.valor;
        else grupo.custoInsumos -= l.valor;
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
    estoqueEntradasCacheAdmin.forEach(e => { if (dentroDoPeriodo(e.data)) saidasCaixa += e.valorTotal; });
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

    let patrimonioTotal = caixaAcumulado + valorRebanho + valorEstoqueAlmoxarifado;

    document.getElementById("patrimonioCaixa").innerText = "R$ " + formatarMoeda(caixaAcumulado);
    document.getElementById("patrimonioRebanho").innerText = "R$ " + formatarMoeda(valorRebanho);
    document.getElementById("patrimonioEstoque").innerText = "R$ " + formatarMoeda(valorEstoqueAlmoxarifado);
    elTotal.innerText = "R$ " + formatarMoeda(patrimonioTotal);
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
    let porLote = agregarCustoLotesFinanceiro();

    let porMes = {};
    function grupoDoMes(ano, mes) {
        let chave = chaveMes(ano, mes);
        if (!porMes[chave]) porMes[chave] = { ano, mes, receitaVendas: 0, custoGadoVendido: 0, despesasGerais: 0 };
        return porMes[chave];
    }

    relatorios.forEach(r => {
        if ((r.tipo || "venda") !== "venda") return;
        let dm = extrairMesAnoDaData(r.data);
        if (!dm) return;
        let d = calcularDadosCompletos(r);
        let nomeLote = r.descricao || "Sem descrição";
        let custoMedio = porLote[nomeLote] ? porLote[nomeLote].custoMedioAnimal : 0;
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

    function formatarResultado(valor) {
        let positivo = valor >= 0;
        return `<span style="color:${positivo ? '#0ca30c' : '#d03b3b'}">${positivo ? '▲' : '▼'} R$ ${formatarMoeda(Math.abs(valor))}</span>`;
    }

    corpo.innerHTML = chaves.map(chave => {
        let g = porMes[chave];
        let resultado = g.receitaVendas - g.custoGadoVendido - g.despesasGerais;
        return `
            <tr>
                <td>${NOMES_MESES_RESULTADO[g.mes]}/${g.ano}</td>
                <td>R$ ${formatarMoeda(g.receitaVendas)}</td>
                <td>R$ ${formatarMoeda(g.custoGadoVendido)}</td>
                <td>R$ ${formatarMoeda(g.despesasGerais)}</td>
                <td>${formatarResultado(resultado)}</td>
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

        m.patrimonio = caixa + rebanho + estoqueAlmox;
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
}

function limparFiltrosCaixa() {
    document.getElementById("caixaDataInicio").value = "";
    document.getElementById("caixaDataFim").value = "";
    mostrarFluxoCaixa();
}

function mostrarFluxoCaixa() {
    let corpo = document.getElementById("corpoTabelaFluxoCaixa");
    if (!corpo) return;

    let dataInicio = document.getElementById("caixaDataInicio").value; // "" ou "yyyy-mm-dd"
    let dataFim = document.getElementById("caixaDataFim").value;

    // monta a lista COMPLETA (sem filtro) primeiro — o saldo acumulado é
    // sempre sobre todo o histórico, igual um extrato bancário; o filtro de
    // período só decide quais linhas aparecem na tela, não "zera" o saldo.
    let movimentos = [];

    if (saldoInicialCache.valor) {
        let dataISO = extrairDataISO(saldoInicialCache.data);
        if (dataISO) {
            movimentos.push({
                dataISO, data: saldoInicialCache.data, tipo: "entrada",
                origem: "Saldo Inicial",
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
            origem: "Pesagem" + (r.numero ? " Nº " + r.numero : ""),
            descricao: (r.vendedor || "Não informado") + (r.descricao && r.descricao !== "Sem descrição" ? " — " + r.descricao : ""),
            valor: d.totalRS
        });
    });

    // a saída de estoque em si não move dinheiro (o produto já tinha sido
    // pago) — quem representa o gasto real é a ENTRADA de estoque, feita
    // contra a nota fiscal no momento da compra.
    estoqueEntradasCacheAdmin.forEach(e => {
        let dataISO = extrairDataISO(e.data);
        if (!dataISO) return;
        movimentos.push({
            dataISO, data: e.data, tipo: "saida",
            origem: "Almoxarifado",
            descricao: "Compra de " + e.produtoDescricao + (e.numeroNota ? " (NF " + e.numeroNota + ")" : ""),
            valor: e.valorTotal,
            id: e.id, excluivel: true, tipoOrigem: "entrada"
        });
    });

    caixaLancamentosCacheAdmin.forEach(l => {
        let dataISO = extrairDataISO(l.data);
        if (!dataISO) return;
        movimentos.push({
            dataISO, data: l.data, tipo: l.tipo,
            origem: "Manual" + (l.categoria ? " — " + l.categoria : ""),
            descricao: (l.descricao || l.categoria || "—") + (l.loteNome ? " (Lote: " + l.loteNome + ")" : ""),
            valor: l.valor,
            id: l.id, excluivel: true, tipoOrigem: "manual"
        });
    });

    movimentos.sort((a, b) => (a.dataISO < b.dataISO ? -1 : (a.dataISO > b.dataISO ? 1 : 0)));

    let saldoCorrente = 0;
    movimentos.forEach(m => {
        saldoCorrente += (m.tipo === "entrada" ? m.valor : -m.valor);
        m.saldoAcumulado = saldoCorrente;
    });

    let visiveis = movimentos.filter(m =>
        (!dataInicio || m.dataISO >= dataInicio) && (!dataFim || m.dataISO <= dataFim)
    );

    if (visiveis.length === 0) {
        corpo.innerHTML = `<tr><td colspan="7">Nenhuma movimentação no período.</td></tr>`;
    } else {
        corpo.innerHTML = [...visiveis].reverse().map(m => {
            let tagTipo = m.tipo === "entrada"
                ? `<span class="tagTipo tagTipoVenda">ENTRADA</span>`
                : `<span class="tagTipo tagTipoCompra">SAÍDA</span>`;
            return `
                <tr>
                    <td>${m.data}</td>
                    <td>${tagTipo}</td>
                    <td>${m.origem}</td>
                    <td>${m.descricao}</td>
                    <td>R$ ${formatarMoeda(m.valor)}</td>
                    <td>R$ ${formatarMoeda(m.saldoAcumulado)}</td>
                    <td>${m.excluivel ? `<button onclick='excluirMovimentoCaixa(${JSON.stringify(m.id)}, ${JSON.stringify(m.tipoOrigem)})'>🗑️</button>` : "—"}</td>
                </tr>
            `;
        }).join("");
    }

    let totalEntradas = visiveis.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
    let totalSaidas = visiveis.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
    document.getElementById("caixaTotalEntradas").innerText = "R$ " + formatarMoeda(totalEntradas);
    document.getElementById("caixaTotalSaidas").innerText = "R$ " + formatarMoeda(totalSaidas);
    let saldoEl = document.getElementById("caixaSaldoPeriodo");
    let saldoPeriodo = totalEntradas - totalSaidas;
    let positivo = saldoPeriodo >= 0;
    saldoEl.innerText = (positivo ? "▲ R$ " : "▼ R$ ") + formatarMoeda(Math.abs(saldoPeriodo));
    saldoEl.style.color = positivo ? "#0ca30c" : "#d03b3b";
}

async function abrirModalLancamento() {
    document.getElementById("lancamentoTipoInput").value = "saida";
    document.getElementById("lancamentoCategoriaInput").value = "";
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

    let erroEl = document.getElementById("lancamentoErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
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
        let categoria = document.getElementById("lancamentoCategoriaInput").value.trim();
        let loteNome = document.getElementById("lancamentoLoteInput").value;
        let descricao = document.getElementById("lancamentoDescricaoInput").value.trim();
        let valorTexto = document.getElementById("lancamentoValorInput").value.trim();
        let valor = parseFloat(valorTexto.replace(/\./g, "").replace(",", "."));
        let dataInput = document.getElementById("lancamentoDataInput").value;

        if (!Number.isFinite(valor) || valor <= 0) { mostrarErro("Informe um valor válido."); return; }

        let dataFormatada = dataInput ? formatarDataBR(dataInput) : new Date().toLocaleString("pt-BR");

        let resp = await fetch(`${API_URL}/api/caixa-lancamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ tipo, categoria: categoria || null, descricao: descricao || null, valor, data: dataFormatada, loteNome: loteNome || null })
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { mostrarErro(dados.erro || `Erro ao salvar lançamento (HTTP ${resp.status}).`); return; }

        fecharModalLancamento();
        await carregarCaixaLancamentosAdmin();
        mostrarFluxoCaixa();
    } catch (e) {
        mostrarErro("Erro de conexão: " + e.message);
    }
}

function excluirMovimentoCaixa(id, tipoOrigem) {
    if (tipoOrigem === "entrada") return excluirEntradaDoCaixa(id);
    return excluirLancamento(id);
}

async function excluirLancamento(id) {
    if (!confirm("Excluir este lançamento?")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/caixa-lancamentos/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir lançamento (HTTP ${resp.status}).`); return; }
        await carregarCaixaLancamentosAdmin();
        mostrarFluxoCaixa();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

async function excluirEntradaDoCaixa(id) {
    if (!confirm("Excluir esta entrada de estoque? Só é possível se esse estoque ainda não tiver sido consumido em nenhuma saída.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/estoque-entradas/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir entrada (HTTP ${resp.status}).`); return; }
        await Promise.all([carregarCaixaLancamentosAdmin(), carregarEstoqueEntradasAdmin()]);
        mostrarFluxoCaixa();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}
