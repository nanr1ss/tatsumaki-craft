function checkAccess() {
    const code = document.getElementById('access-code').value;
    
    // Админский код
    if (code === "admin777") {
        alert("Вход выполнен: Режим Администратора");
        window.location.href = "admin.html"; // Страница админа
    } 
    // Код участника
    else if (code === "user123") {
        alert("Вход выполнен: Режим Участника");
        window.location.href = "calculator.html"; // Страница калькулятора
    } 
    else {
        alert("Ошибка: Неверный код доступа!");
    }
}