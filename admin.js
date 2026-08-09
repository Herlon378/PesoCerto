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
