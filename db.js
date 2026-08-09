// ========================================
// BANCO DE DADOS DE SALVAMENTO DEFINITIVO
// ========================================
function salvarPesagem(){
    let vendedor = document.getElementById("nomeVendedor").value;
    let descricao = document.getElementById("descricao").value;
    let valorKg = document.getElementById("valorKg").value;
    let tipoEl = document.getElementById("tipoOperacao");
    let tipoPesagemEl = document.getElementById("tipoPesagem");
    let rendEl = document.getElementById("rendimentoArroba");

    let dados = {
        id: crypto.randomUUID(),
        vendedor: vendedor || "Geral",
        descricao: descricao || "Sem descrição",
        valorKg: valorKg || "R$ 0,00",
        tipo: tipoEl ? tipoEl.value : "venda",
        tipoPesagem: tipoPesagemEl ? tipoPesagemEl.value : "vivo",
        rendimento: rendEl ? rendEl.value : "",
        pesos: pesos,
        data: new Date().toLocaleString("pt-BR"),
        sincronizado: false
    };

    let lista = JSON.parse(localStorage.getItem("pesagens") || "[]");
    lista.push(dados);

    localStorage.setItem("pesagens", JSON.stringify(lista));
    localStorage.removeItem("pesagemAtual");

    if(typeof sincronizarAgora === "function") {
        sincronizarAgora();
    }
}

/* salvamento automático */
function salvarPesagemAuto(){
    let vendedor = document.getElementById("nomeVendedor").value;
    let valorKg = document.getElementById("valorKg").value;
    let descricao = document.getElementById("descricao").value;
    let tipoEl = document.getElementById("tipoOperacao");
    let tipoPesagemEl = document.getElementById("tipoPesagem");
    let rendEl = document.getElementById("rendimentoArroba");

    let dados = {
        vendedor: vendedor,
        valorKg: valorKg,
        descricao: descricao,
        tipo: tipoEl ? tipoEl.value : "venda",
        tipoPesagem: tipoPesagemEl ? tipoPesagemEl.value : "vivo",
        rendimento: rendEl ? rendEl.value : "",
        pesos: pesos,
        data: new Date()
    };

    localStorage.setItem("pesagemAtual", JSON.stringify(dados));
}

/* restaurar pesagem se fechar */
function restaurarPesagem(){
    try {
        let dados = JSON.parse(localStorage.getItem("pesagemAtual"));
        if(!dados) return;

        pesos = dados.pesos || [];

        document.getElementById("nomeVendedor").value = dados.vendedor || "";
        document.getElementById("descricao").value = dados.descricao || "";
        if(document.getElementById("valorKg") && dados.valorKg) {
            document.getElementById("valorKg").value = dados.valorKg;
        }
        if(document.getElementById("tipoOperacao") && dados.tipo) {
            document.getElementById("tipoOperacao").value = dados.tipo;
        }
        if(document.getElementById("tipoPesagem") && dados.tipoPesagem) {
            document.getElementById("tipoPesagem").value = dados.tipoPesagem;
        }
        if(document.getElementById("rendimentoArroba") && dados.rendimento) {
            document.getElementById("rendimentoArroba").value = dados.rendimento;
        }
        if(typeof alternarTipoPesagem === "function") {
            alternarTipoPesagem();
        }

        if(typeof atualizarStats === "function") {
            atualizarStats();
        }
    } catch(e) {}
}