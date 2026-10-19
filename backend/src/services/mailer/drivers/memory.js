// Test driver: keeps sent mail in an in-process outbox.
let sent = [];

const deliver = async (mail) => {
  sent.push(mail);
};

const outbox = () => sent.map((mail) => ({ ...mail }));

const clear = () => {
  sent = [];
};

module.exports = { deliver, outbox, clear };
