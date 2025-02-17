const pg = require('pg');
// require the jsonwebtoken package
const jwt = require('jsonwebtoken');
// pull secret from environment variable or use default
const secret = process.env.JWT || 'shhh';
const client = new pg.Client();
const uuid = require('uuid');
const bcrypt = require('bcrypt');

const createTables = async () => {
  const SQL = `
    DROP TABLE IF EXISTS user_skills;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS skills;
    CREATE TABLE users(
      id UUID PRIMARY KEY,
      username VARCHAR(20) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    );
    CREATE TABLE skills(
      id UUID PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE
    );
    CREATE TABLE user_skills(
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) NOT NULL,
      skill_id UUID REFERENCES skills(id) NOT NULL,
      CONSTRAINT unique_user_id_skill_id UNIQUE (user_id, skill_id)
    );
  `;
  await client.query(SQL);
};

const createUser = async ({ username, password }) => {
  const SQL = `
    INSERT INTO users(id, username, password) VALUES($1, $2, $3) RETURNING *
  `;
  const response = await client.query(SQL, [
    uuid.v4(),
    username,
    await bcrypt.hash(password, 5),
  ]);
  return response.rows[0];
};

const createSkill = async ({ name }) => {
  const SQL = `
    INSERT INTO skills(id, name) VALUES ($1, $2) RETURNING * 
  `;
  const response = await client.query(SQL, [uuid.v4(), name]);
  return response.rows[0];
};

const authenticate = async ({ username, password }) => {
  const SQL = `
    SELECT id, password
    FROM users
    WHERE username = $1
  `;
  const response = await client.query(SQL, [username]);
  // add in password check
  // use bcrypt compare against plain text password vs hashed password in data base
  if (
    // look to see if the response is empty or if the password does not match
    !response.rows.length ||
    (await bcrypt.compare(password, response.rows[0].password)) === false
  ) {
    // if no user or password does not match
    const error = Error('not authorized');
    error.status = 401;
    throw error;
  }
  // if user and password match
  // return the token jwt.sign is the function that creates the token and takes two arguments the payload and the secret
  const token = await jwt.sign({ id: response.rows[0].id }, secret);
  console.log('Token:', token);
  return { token };
};

const createUserSkill = async ({ user_id, skill_id }) => {
  const SQL = `
    INSERT INTO user_skills(id, user_id, skill_id) VALUES ($1, $2, $3) RETURNING * 
  `;
  const response = await client.query(SQL, [uuid.v4(), user_id, skill_id]);
  return response.rows[0];
};

const fetchUsers = async () => {
  const SQL = `
    SELECT id, username 
    FROM users
  `;
  const response = await client.query(SQL);
  return response.rows;
};

const fetchSkills = async () => {
  const SQL = `
    SELECT *
    FROM skills
  `;
  const response = await client.query(SQL);
  return response.rows;
};

const fetchUserSkills = async (user_id) => {
  const SQL = `
    SELECT *
    FROM user_skills
    WHERE user_id = $1
  `;
  const response = await client.query(SQL, [user_id]);
  return response.rows;
};

const deleteUserSkill = async ({ user_id, id }) => {
  const SQL = `
    DELETE
    FROM user_skills
    WHERE user_id = $1 AND id = $2
  `;
  await client.query(SQL, [user_id, id]);
};

const findUserByToken = async (token) => {
  console.log("TOKEN, ", token);
  let id;
  try {
    // backend is verifying the token by desconstructing the token with the secret: if theres and error it throws an error
    const payload = jwt.verify(token, secret);
    // if no errror get the id from the payload and set it to the id variable which will be used to query the database
    id = payload.id;
  } catch (error) {
    const err = Error('not authorized');
    err.status = 401;
    throw err;
  }
  // if the token is verified then it will return the user id
  const SQL = `
    SELECT id, username
    FROM users
    WHERE id = $1
  `;
  const response = await client.query(SQL, [id]);
  if (!response.rows.length) {
    const error = Error('not authorized');
    error.status = 401;
    throw error;
  }
  return response.rows[0];
};

module.exports = {
  client,
  createTables,
  createUser,
  createSkill,
  fetchUsers,
  fetchSkills,
  createUserSkill,
  fetchUserSkills,
  deleteUserSkill,
  authenticate,
  findUserByToken,
};
