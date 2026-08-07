// ========================================
// BANCO DE DADOS DE SALVAMENTO DEFINITIVO
// ========================================
function salvarPesagem(){
    let vendedor = document.getElementById("nomeVendedor").value;
    let descricao = document.getElementById("descricao").value;
    let valorKg = document.getElementById("valorKg").value;

    let dados = {
        vendedor: vendedor || "Geral",
        descricao: descricao || "Sem descrição",
        valorKg: valorKg || "R$ 0,00",
        pesos: pesos,
        data: new Date().toLocaleString("pt-BR")
    };

    let lista = JSON.parse(localStorage.getItem("pesagens") || "[]");
    lista.push(dados);

    localStorage.setItem("pesagens", JSON.stringify(lista));
    localStorage.removeItem("pesagemAtual");
}

/* salvamento automático */
function salvarPesagemAuto(){
    let vendedor = document.getElementById("nomeVendedor").value;
    let valorKg = document.getElementById("valorKg").value;
    let descricao = document.getElementById("descricao").value;

    let dados = {
        vendedor: vendedor,
        valorKg: valorKg,
        descricao: descricao,
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

        if(typeof atualizarStats === "function") {
            atualizarStats();
        }
    } catch(e) {}
}