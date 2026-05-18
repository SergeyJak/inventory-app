const bcrypt = require('bcryptjs');
bcrypt.hash('admin', 10).then(h => {
    console.log('admin: ' + h);
    bcrypt.hash('andrey', 10).then(h2 => {
        console.log('andrey: ' + h2);
        process.exit(0);
    });
});
