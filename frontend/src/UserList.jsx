socket.on('update-user-list', (userList) => {
    const userSelect = document.getElementById('userSelect');
    userSelect.innerHTML = ''; // Clear old list

    userList.forEach(user => {
        const option = document.createElement('option');
        option.text = user.name;
        userSelect.add(option);
    });
});
