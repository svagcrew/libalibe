// import { orderRootLibPackagesFromDependsOnToDependent } from '@/lib/utils.js'

describe('utils', () => {
  it('test', async () => {
    // const result = await orderRootLibPackagesFromDependsOnToDependent({
    //   rootLibPackagesData: [
    //     {
    //       libPackageName: 'c',
    //       libPackagePath: '.',
    //       libPackageJsonData: {
    //         name: 'c',
    //         dependencies: {},
    //       },
    //     },
    //     {
    //       libPackageName: 'a',
    //       libPackagePath: '.',
    //       libPackageJsonData: {
    //         name: 'a',
    //         dependencies: { b: '1.0.0' },
    //       },
    //     },
    //     {
    //       libPackageName: 'b',
    //       libPackagePath: '.',
    //       libPackageJsonData: {
    //         name: 'b',
    //         dependencies: { c: '1.0.0' },
    //       },
    //     },
    //   ],
    // })
    // expect(result.rootLibPackagesDataOrdered.map((d) => d.libPackageName)).toMatchInlineSnapshot(`
    //   [
    //     "c",
    //     "b",
    //     "a",
    //   ]
    // `)
  })
})
