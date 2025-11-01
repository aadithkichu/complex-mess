import bcrypt from 'bcryptjs';

// 1. SET YOUR PASSWORD HERE
const password = 'kichu123321';

// 2. Run the script
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('Your Password Hash:');
console.log(hash);