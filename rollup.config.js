import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import copy from 'rollup-plugin-copy';

export default {
    input: 'src/index.ts',
    output: {
        dir: 'dist',
        format: 'es',
        sourcemap: true
    },
    plugins: [
        typescript({
            tsconfig: 'tsconfig.json',
            sourceMap: true,
            inlineSources: true
        }),
        nodeResolve(),
        commonjs(),
        terser({
            keep_classnames: true,
            keep_fnames: true
        }),
        copy({
            targets: [
                { src: 'module.json', dest: 'dist' },
                { src: 'styles', dest: 'dist' },
                { src: 'lang', dest: 'dist' }
            ]
        })
    ],
    external: [
        // Add any external dependencies that should not be bundled
        // For example, if you're using external libraries from Foundry
    ]
};