-- Создание таблицы для тестов
CREATE TABLE tests (
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT
);

-- Создание таблицы для вопросов
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    test_id INTEGER REFERENCES tests(id),
    question TEXT NOT NULL
);

-- Создание таблицы для ответов
CREATE TABLE answers (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES questions(id),
    answer TEXT NOT NULL,
    is_correct BOOLEAN
);
