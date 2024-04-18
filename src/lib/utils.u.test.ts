import { orderLibPackagesFromDependsOnToDependent } from '@/lib/utils'

describe('utils', () => {
  it('test', () => {
    const result = orderLibPackagesFromDependsOnToDependent({
      libPackagesData: [
        {
          libPackageName: 'c',
          libPackagePath: '.',
          libPackageJsonData: {
            name: 'c',
            dependencies: {},
          },
        },
        {
          libPackageName: 'a',
          libPackagePath: '.',
          libPackageJsonData: {
            name: 'a',
            dependencies: { b: '1.0.0' },
          },
        },
        {
          libPackageName: 'b',
          libPackagePath: '.',
          libPackageJsonData: {
            name: 'b',
            dependencies: { c: '1.0.0' },
          },
        },
      ],
    })
    expect(result.libPackagesDataOrdered.map((d) => d.libPackageName)).toMatchInlineSnapshot(`
      [
        "c",
        "b",
        "a",
      ]
    `)
  })
})
