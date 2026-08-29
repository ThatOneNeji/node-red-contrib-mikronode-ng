module.exports = [
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                module: 'readonly',
                require: 'readonly',
                process: 'readonly',
                console: 'readonly'
            }
        },
        rules: {
            'space-before-function-paren': ['error', {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always'
            }]
        }
    }
];
