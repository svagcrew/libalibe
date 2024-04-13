import { Config } from "./config";
import { exec, stringsToLikeArrayString } from "./utils";

export const link = async ({
  cwd,
  config,
  packageJsonData,
}: {
  cwd: string;
  config: Config;
  packageJsonData: any;
}) => {
  const include = config.include;
  const exclude = config.exclude;
  const libPackages = include.filter((include) => !exclude.includes(include));
  const dependencies = [
    ...new Set([
      ...Object.keys(packageJsonData.dependencies || {}),
      ...Object.keys(packageJsonData.devDependencies || {}),
    ]),
  ];
  const libPackagesToLink = libPackages.filter((libPackage) =>
    dependencies.includes(libPackage)
  );
  // const libPackagesToUnlink = libPackages.filter(
  //   (libPackage) => !dependencies.includes(libPackage)
  // );
  if (libPackagesToLink.length) {
    const command = `pnpm link -g ${libPackagesToLink.join(" ")}`;
    // console.info(`$ ${command}`);
    const out = await exec({ command, cwd });
    // console.info(out);
    console.info(`Linked: ${stringsToLikeArrayString(libPackagesToLink)}`);
  } else {
    console.info("Nothing to link");
  }
  // if (libPackagesToUnlink.length) {
  //   const command = `pnpm unlink -g ${libPackagesToUnlink.join(" ")}`;
  //   console.info(`$ ${command}`);
  //   const out = await exec({ command, cwd });
  //   console.info(out);
  // }
};
