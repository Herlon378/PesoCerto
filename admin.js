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
                    ${u.permissaoVacasMatriz ? `<span class="tagPermissao">🐄 Vacas Matriz</span>` : ""}
                    ${u.permissaoEditarNascimentos ? `<span class="tagPermissao">✏️ Editar Nascimentos</span>` : ""}
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
        return transferenciasLotesCacheAdmin;
    } catch (e) {
        return [];
    }
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
    document.getElementById("transfDataInput").value = new Date().toISOString().slice(0, 10);
    let erroEl = document.getElementById("transfErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
    await atualizarPreviewTransferencia();
    document.getElementById("modalTransferenciaLote").style.display = "flex";
}

async function atualizarPreviewTransferencia() {
    let preview = document.getElementById("transfPreview");
    if (!preview) return;
    let loteOrigem = document.getElementById("transfLoteOrigemInput").value;
    let qtd = parseFloat(document.getElementById("transfQuantidadeInput").value.replace(",", ".")) || 0;
    if (!loteOrigem) { preview.innerText = ""; return; }

    await carregarCachesFinanceirasDashboard();
    let porLote = agregarCustoLotesFinanceiro();
    let g = porLote[loteOrigem];
    let custoMedio = g ? g.custoMedioAnimal : 0;
    let headcount = g ? g.headcountAtual : 0;

    let texto = `Animais disponíveis em "${loteOrigem}": ${headcount} · Custo médio: R$ ${formatarMoeda(custoMedio)}/animal`;
    if (qtd > 0) texto += ` · Total a transferir: R$ ${formatarMoeda(qtd * custoMedio)}`;
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

        let porLote = agregarCustoLotesFinanceiro();
        let g = porLote[loteOrigem];
        let custoMedio = g ? g.custoMedioAnimal : 0;

        let resp = await fetch(`${API_URL}/api/transferencias-lotes`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ loteOrigem, loteDestino, quantidade, custoUnitario: custoMedio, data: formatarDataBR(dataISOSimples) })
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
    if (transferenciasLotesCacheAdmin.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6">Nenhuma transferência registrada ainda.</td></tr>`;
        return;
    }
    corpo.innerHTML = transferenciasLotesCacheAdmin.map(t => `
        <tr>
            <td>${t.data || "—"}</td>
            <td>${t.loteOrigem}</td>
            <td>${t.loteDestino}</td>
            <td>${t.quantidade}</td>
            <td>R$ ${formatarMoeda(t.valorTotal)}</td>
            <td class="acoesUsuario"><button onclick='excluirTransferenciaLote(${JSON.stringify(t.id)})'>🗑️</button></td>
        </tr>
    `).join("");
}

async function excluirTransferenciaLote(id) {
    if (!confirm("Desfazer esta transferência? Os animais voltam pro lote de origem.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/transferencias-lotes/${id}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await atualizarTelasAposMudancaDeLote();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
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

// visão geral do Almoxarifado (tela hub) — quantos produtos, quanto dinheiro
// está parado em estoque e quais produtos zeraram, pra saber o que repor
// sem precisar entrar em Produtos e ler linha por linha.
async function mostrarDashboardProdutos() {
    let elAtivos = document.getElementById("almoxProdutosAtivos");
    let corpo = document.getElementById("corpoTabelaDashboardProdutos");
    if (!elAtivos || !corpo) return;

    await carregarProdutosAdmin();
    let ativos = produtosCacheAdmin.filter(p => p.ativo);

    let valorTotalEstoque = ativos.reduce((soma, p) => soma + (p.saldoAtual || 0) * (p.custoMedioUnitario || 0), 0);
    let semEstoque = ativos.filter(p => (p.saldoAtual || 0) <= 0).length;

    elAtivos.innerText = ativos.length;
    document.getElementById("almoxValorEstoque").innerText = "R$ " + formatarMoeda(valorTotalEstoque);
    document.getElementById("almoxSemEstoque").innerText = semEstoque;

    if (ativos.length === 0) {
        corpo.innerHTML = `<tr><td colspan="5">Nenhum produto ativo cadastrado ainda.</td></tr>`;
        return;
    }

    let ordenados = [...ativos].sort((a, b) => {
        let valorA = (a.saldoAtual || 0) * (a.custoMedioUnitario || 0);
        let valorB = (b.saldoAtual || 0) * (b.custoMedioUnitario || 0);
        return valorB - valorA;
    });

    corpo.innerHTML = ordenados.map(p => {
        let valor = (p.saldoAtual || 0) * (p.custoMedioUnitario || 0);
        let semEstoqueLinha = (p.saldoAtual || 0) <= 0;
        return `
            <tr>
                <td>${p.descricao}</td>
                <td>${p.departamentoNome || "—"}</td>
                <td style="color:${semEstoqueLinha ? '#d03b3b' : 'inherit'}">${formatarPeso(p.saldoAtual)} ${p.unidade}${semEstoqueLinha ? " ⚠️" : ""}</td>
                <td>R$ ${formatarMoeda(p.custoMedioUnitario)}</td>
                <td>R$ ${formatarMoeda(valor)}</td>
            </tr>
        `;
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

    await Promise.all([carregarEstoqueSaidasAdmin(), carregarCaixaLancamentosAdmin(), carregarTransferenciasLotesAdmin()]);

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

    // transferência entre lotes: sai do lote origem como se fosse vendido
    // (headcount desconta, custo não muda — igual uma venda faria com o
    // custo médio dos que ficaram), e entra no destino como custo de
    // aquisição, no valor exato que saiu — não cria nem apaga patrimônio,
    // só reorganiza entre os dois lotes.
    transferenciasLotesCacheAdmin.forEach(t => {
        grupoDoLote(t.loteOrigem).vendidos += t.quantidade;
        let destino = grupoDoLote(t.loteDestino);
        destino.comprados += t.quantidade;
        destino.custoCompra += t.valorTotal;
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
        carregarSaldoInicial(),
        carregarTransferenciasLotesAdmin()
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

    // mesmo tratamento do Custo por Lote: transferência tira headcount do
    // lote origem (sem mexer no custo médio de quem ficou) e leva o valor
    // junto pro destino — soma total sempre igual, não é compra nem venda.
    transferenciasLotesCacheAdmin.forEach(t => {
        if (!dentroDoPeriodo(t.data)) return;
        grupoDoLote(t.loteOrigem).vendidos += t.quantidade;
        let destino = grupoDoLote(t.loteDestino);
        destino.comprados += t.quantidade;
        destino.custoCompra += t.valorTotal;
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
        if (!resp.ok) { alert(dados.erro || `Erro ao atualizar sub-caixa (HTTP ${resp.status}).`); return; }
        await mostrarSubCaixas();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

async function excluirSubCaixa(id, nome) {
    if (!confirm(`Excluir o sub-caixa "${nome}"? Os lançamentos já marcados com ele continuam existindo normalmente, só perdem essa etiqueta.`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/sub-caixas/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir sub-caixa (HTTP ${resp.status}).`); return; }
        await mostrarSubCaixas();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
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

    if (lista) {
        lista.innerHTML = subCaixasCacheAdmin.length === 0
            ? `<p style="font-size:13px;color:#999;padding:8px 0">Nenhum sub-caixa cadastrado ainda.</p>`
            : subCaixasCacheAdmin.map(s => `
                <div class="itemDepartamentoModal">
                    <span>${s.nome}${s.ativo ? "" : " (inativo)"}</span>
                    <span>
                        <button onclick='alternarAtivoSubCaixa(${JSON.stringify(s.id)}, ${!s.ativo})'>${s.ativo ? "🚫" : "✅"}</button>
                        <button onclick='excluirSubCaixa(${JSON.stringify(s.id)}, ${JSON.stringify(s.nome)})'>🗑️</button>
                    </span>
                </div>
            `).join("");
    }

    if (!corpo) return;
    let porSubCaixa = {};
    caixaLancamentosCacheAdmin.forEach(l => {
        if (!l.subCaixaNome) return;
        if (!porSubCaixa[l.subCaixaNome]) porSubCaixa[l.subCaixaNome] = { entradas: 0, saidas: 0 };
        if (l.tipo === "saida") porSubCaixa[l.subCaixaNome].saidas += l.valor;
        else porSubCaixa[l.subCaixaNome].entradas += l.valor;
    });

    let nomes = Object.keys(porSubCaixa).sort();
    if (nomes.length === 0) {
        corpo.innerHTML = `<tr><td colspan="4">Nenhum lançamento marcado com sub-caixa ainda.</td></tr>`;
        return;
    }
    corpo.innerHTML = nomes.map(nome => {
        let s = porSubCaixa[nome];
        let saldo = s.entradas - s.saidas;
        let positivo = saldo >= 0;
        return `
            <tr>
                <td>${nome}</td>
                <td>R$ ${formatarMoeda(s.entradas)}</td>
                <td>R$ ${formatarMoeda(s.saidas)}</td>
                <td style="color:${positivo ? '#0ca30c' : '#d03b3b'}">${positivo ? '▲' : '▼'} R$ ${formatarMoeda(Math.abs(saldo))}</td>
            </tr>
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
    mostrarSubCaixas();
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

    // saldo de verdade, com TODO o histórico — não se mexe com o filtro de
    // período abaixo, senão passa a impressão errada de que o dinheiro
    // "sumiu" só porque a tela está filtrada numa janela de datas.
    let elSaldoAtual = document.getElementById("caixaSaldoAtual");
    if (elSaldoAtual) elSaldoAtual.innerText = "R$ " + formatarMoeda(saldoCorrente);

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
    let selectSubCaixa = document.getElementById("lancamentoSubCaixaInput");
    if (token && selectSubCaixa) {
        await carregarSubCaixasAdmin();
        selectSubCaixa.innerHTML = `<option value="">Caixa Geral (sem sub-caixa)</option>` +
            subCaixasCacheAdmin.filter(s => s.ativo).map(s => `<option value="${s.nome.replace(/"/g, "&quot;")}">${s.nome}</option>`).join("");
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
            body: JSON.stringify({ tipo, categoria: categoria || null, descricao: descricao || null, valor, data: dataFormatada, loteNome: loteNome || null, subCaixaNome: subCaixaNome || null })
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
function statusParcela(parcela) {
    if (parcela.paga) return { chave: "paga", texto: "✅ Paga", cor: "#0ca30c" };
    let hojeISO = new Date().toISOString().slice(0, 10);
    let vencISO = extrairDataISO(parcela.dataVencimento);
    if (!vencISO) return { chave: "pendente", texto: "Pendente", cor: "#52514e" };
    if (vencISO < hojeISO) return { chave: "vencida", texto: "🔴 Vencida", cor: "#d03b3b" };
    let limite = new Date();
    limite.setDate(limite.getDate() + CP_DIAS_VENCENDO_EM_BREVE);
    let limiteISO = limite.toISOString().slice(0, 10);
    if (vencISO <= limiteISO) return { chave: "vencendo", texto: "⏰ Vence em breve", cor: "#b8860b" };
    return { chave: "pendente", texto: "Pendente", cor: "#52514e" };
}

async function abrirTelaContasPagar() {
    await carregarContasPagarAdmin();
    mostrarContasPagar();
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

    let totalPendente = 0, totalVencendo = 0, totalVencida = 0;
    linhas.forEach(l => {
        if (l.status.chave === "paga") return;
        totalPendente += l.parcela.valor;
        if (l.status.chave === "vencendo") totalVencendo += l.parcela.valor;
        if (l.status.chave === "vencida") totalVencida += l.parcela.valor;
    });
    let elPendente = document.getElementById("cpTotalPendente");
    if (elPendente) elPendente.innerText = "R$ " + formatarMoeda(totalPendente);
    let elVencendo = document.getElementById("cpVencendoBreve");
    if (elVencendo) elVencendo.innerText = "R$ " + formatarMoeda(totalVencendo);
    let elVencida = document.getElementById("cpVencidas");
    if (elVencida) elVencida.innerText = "R$ " + formatarMoeda(totalVencida);

    let filtroStatus = document.getElementById("cpFiltroStatus");
    let statusFiltro = filtroStatus ? filtroStatus.value : "";
    if (statusFiltro) linhas = linhas.filter(l => l.status.chave === statusFiltro);

    linhas.sort((a, b) => {
        let da = extrairDataISO(a.parcela.dataVencimento) || "";
        let db = extrairDataISO(b.parcela.dataVencimento) || "";
        return da < db ? -1 : (da > db ? 1 : 0);
    });

    if (linhas.length === 0) {
        corpo.innerHTML = `<tr><td colspan="8">Nenhuma conta encontrada.</td></tr>`;
        return;
    }

    corpo.innerHTML = linhas.map(l => {
        let acoes = l.status.chave === "paga"
            ? `<button onclick='estornarPagamentoParcela(${JSON.stringify(l.parcela.id)})'>↩️ Estornar</button>`
            : `<button onclick='abrirModalPagarParcela(${JSON.stringify(l.parcela.id)})'>💰 Pagar</button>`;
        if (l.parcela.numero === 1) {
            acoes += `<button onclick='excluirContaPagar(${JSON.stringify(l.conta.id)}, ${JSON.stringify(l.conta.descricao)})'>🗑️</button>`;
        }
        return `
            <tr>
                <td>${l.parcela.dataVencimento ? l.parcela.dataVencimento.split(",")[0] : "—"}</td>
                <td>${l.conta.descricao}</td>
                <td>${l.parcela.numero}/${l.conta.numeroParcelas}</td>
                <td>R$ ${formatarMoeda(l.parcela.valor)}</td>
                <td style="color:${l.status.cor}">${l.status.texto}</td>
                <td>${l.conta.loteNome || "—"}</td>
                <td>${l.conta.subCaixaNome || "—"}</td>
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
    document.getElementById("cpCategoriaInput").value = "";
    document.getElementById("cpValorTotalInput").value = "";
    document.getElementById("cpNumeroParcelasInput").value = "1";
    document.getElementById("cpPrimeiroVencimentoInput").value = new Date().toISOString().slice(0, 10);
    let erroEl = document.getElementById("cpErro");
    if (erroEl) { erroEl.style.display = "none"; erroEl.innerText = ""; }
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
        let dataParcela = new Date(ano, mes - 1 + (i - 1), dia);
        let isoParcela = `${dataParcela.getFullYear()}-${String(dataParcela.getMonth() + 1).padStart(2, "0")}-${String(dataParcela.getDate()).padStart(2, "0")}`;
        parcelas.push({ numero: i, valor, dataVencimento: formatarDataBR(isoParcela) });
    }
    return parcelas;
}

function atualizarPreviewContaPagar() {
    let preview = document.getElementById("cpPreview");
    if (!preview) return;
    let valorTotal = parseFloat(document.getElementById("cpValorTotalInput").value.replace(",", ".")) || 0;
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
        let categoria = document.getElementById("cpCategoriaInput").value.trim();
        let valorTotal = parseFloat(document.getElementById("cpValorTotalInput").value.replace(",", "."));
        let numeroParcelas = parseInt(document.getElementById("cpNumeroParcelasInput").value, 10);
        let primeiraData = document.getElementById("cpPrimeiroVencimentoInput").value;
        let loteNome = document.getElementById("cpLoteInput").value;
        let subCaixaNome = document.getElementById("cpSubCaixaInput").value;

        if (!descricao) { mostrarErro("Informe a descrição."); return; }
        if (!Number.isFinite(valorTotal) || valorTotal <= 0) { mostrarErro("Informe um valor total válido."); return; }
        if (!Number.isInteger(numeroParcelas) || numeroParcelas <= 0) { mostrarErro("Número de parcelas inválido."); return; }
        if (!primeiraData) { mostrarErro("Informe a data do primeiro vencimento."); return; }

        let parcelas = calcularParcelasContaPagar(valorTotal, numeroParcelas, primeiraData);

        let resp = await fetch(`${API_URL}/api/contas-pagar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ descricao, categoria: categoria || null, valorTotal, loteNome: loteNome || null, subCaixaNome: subCaixaNome || null, parcelas })
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
    if (!confirm(`Excluir a conta "${descricao}" e todas as suas parcelas?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/contas-pagar/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await abrirTelaContasPagar();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
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

    document.getElementById("pagarParcelaInfo").innerText =
        `${achado.conta.descricao} — parcela ${achado.parcela.numero}/${achado.conta.numeroParcelas}, vencimento ${achado.parcela.dataVencimento.split(",")[0]}`;
    document.getElementById("pagarParcelaValorInput").value = String(achado.parcela.valor).replace(".", ",");
    document.getElementById("pagarParcelaDataInput").value = new Date().toISOString().slice(0, 10);
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
}

async function confirmarPagarParcela() {
    let erroEl = document.getElementById("pagarParcelaErro");
    function mostrarErro(msg) { if (erroEl) { erroEl.innerText = msg; erroEl.style.display = "block"; } }

    try {
        let token = obterToken();
        if (!token) { mostrarErro("Sua sessão expirou."); return; }
        if (!parcelaEmPagamentoId) return;

        let valor = parseFloat(document.getElementById("pagarParcelaValorInput").value.replace(",", "."));
        let dataISO = document.getElementById("pagarParcelaDataInput").value;
        if (!Number.isFinite(valor) || valor <= 0) { mostrarErro("Informe um valor válido."); return; }

        let dataFormatada = dataISO ? formatarDataBR(dataISO) : new Date().toLocaleString("pt-BR");
        let resp = await fetch(`${API_URL}/api/contas-pagar/parcelas/${parcelaEmPagamentoId}/pagar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ valor, data: dataFormatada })
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

async function estornarPagamentoParcela(parcelaId) {
    if (!confirm("Estornar esse pagamento? O lançamento correspondente no Fluxo de Caixa será removido.")) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/contas-pagar/parcelas/${parcelaId}/estornar`, {
            method: "POST",
            headers: { "Authorization": "Bearer " + token }
        });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao estornar (HTTP ${resp.status}).`); return; }

        await abrirTelaContasPagar();
        atualizarRelatoriosFinanceirosAposMudanca();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
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

    elAtivas.innerText = vacasMatrizCacheAdmin.filter(v => v.status === "ativa").length;

    let anoAtual = new Date().getFullYear();
    let nascimentosAno = nascimentosCacheAdmin.filter(n => {
        let dm = extrairMesAnoDaData(n.dataNascimento);
        return dm && dm.ano === anoAtual;
    }).length;
    document.getElementById("vmNascimentosAno").innerText = nascimentosAno;

    let mortesVacasAno = vacasMatrizCacheAdmin.filter(v => {
        if (v.status !== "morta" || !v.dataMorte) return false;
        let dm = extrairMesAnoDaData(v.dataMorte);
        return dm && dm.ano === anoAtual;
    }).length;
    let mortesBezerrosAno = nascimentosCacheAdmin.filter(n => {
        if (n.status !== "morto" || !n.dataMorte) return false;
        let dm = extrairMesAnoDaData(n.dataMorte);
        return dm && dm.ano === anoAtual;
    }).length;
    document.getElementById("vmPerdasAno").innerText = mortesVacasAno + mortesBezerrosAno;
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
                <button onclick='alternarAtivoPasto(${JSON.stringify(p.id)}, ${!p.ativo})'>${p.ativo ? "🚫" : "✅"}</button>
                <button onclick='excluirPasto(${JSON.stringify(p.id)}, ${JSON.stringify(p.nome)})'>🗑️</button>
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
        if (!resp.ok) { alert(dados.erro || `Erro ao atualizar pasto (HTTP ${resp.status}).`); return; }
        carregarPastos();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
    }
}

async function excluirPasto(id, nome) {
    if (!confirm(`Excluir o pasto "${nome}" permanentemente?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/pastos/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir pasto (HTTP ${resp.status}).`); return; }
        carregarPastos();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
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
                <td>${v.raca || "—"}</td>
                <td>${formatarIdadeAnimal(v.dataNascimento)}</td>
                <td>${v.pastoNome || "—"}</td>
                <td style="color:${st.cor}">${st.texto}</td>
                <td>${qtdFilhos}</td>
                <td class="acoesUsuario">
                    <button onclick='abrirModalVaca(${JSON.stringify(v)})'>✏️</button>
                    <button onclick='excluirVaca(${JSON.stringify(v.id)}, ${JSON.stringify(v.numero)})'>🗑️</button>
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
    if (!confirm(`Excluir a vaca "${numero}" permanentemente? Os nascimentos já registrados dela continuam existindo.`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/vacas-matriz/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await carregarVacasMatrizAdmin();
        mostrarVacas();
        mostrarResumoVacasMatriz();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
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
            acoes += `<button onclick='abrirModalEventoNascimento(${JSON.stringify(n.id)}, "apartar")'>✅</button>`;
            acoes += `<button onclick='abrirModalEventoNascimento(${JSON.stringify(n.id)}, "morte")'>⚰️</button>`;
        }
        if (avisoVacinaBrucelose(n)) {
            acoes += `<button onclick='abrirModalEventoNascimento(${JSON.stringify(n.id)}, "vacinar")'>💉</button>`;
        }
        acoes += `<button onclick='excluirNascimento(${JSON.stringify(n.id)}, ${JSON.stringify(n.numeroBezerro)})'>🗑️</button>`;
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
                <td>${n.pastoNome || "—"}</td>
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
    if (!confirm(`Excluir o registro de nascimento do bezerro "${numeroBezerro}"?`)) return;
    try {
        let token = obterToken();
        let resp = await fetch(`${API_URL}/api/nascimentos/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        let dados = await resp.json().catch(() => ({}));
        if (!resp.ok) { alert(dados.erro || `Erro ao excluir (HTTP ${resp.status}).`); return; }
        await carregarNascimentosAdmin();
        mostrarNascimentos();
        mostrarResumoVacasMatriz();
    } catch (e) {
        alert("Erro de conexão: " + e.message);
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
