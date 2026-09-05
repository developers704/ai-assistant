import { normalizeUsername } from "@/lib/auth/user-permissions";
import { applyUserDirectory } from "@/lib/auth/user-directory-store";
import { resolveHrEmployeeDisplayName } from "@/lib/hr/security-guard-names";

export type AuthRole = "admin" | "employee" | "hr" | "dm";

export const AUTH_ROLES: AuthRole[] = ["admin", "employee", "hr", "dm"];

export const AUTH_ROLE_LABEL: Record<AuthRole, string> = {
  admin: "Admin",
  employee: "Employee",
  hr: "HR",
  dm: "District Manager",
};

export const AUTH_ROLE_DESCRIPTION: Record<AuthRole, string> = {
  admin: "Administrator with full permissions.",
  employee: "HR sales and SKU lookup (wholesale cost, no customer offer).",
  hr: "Full HR Management plus users, roles, and permissions.",
  dm: "District manager — sales, stores, and price calculator.",
};

export type AuthUserRecord = {
  username: string;
  /** Display name */
  name: string;
  /** Login / directory email (sheet users) */
  email?: string;
  /** bcrypt hash */
  passwordHash: string;
  role: AuthRole;
  /** POS store codes; ignored when role=admin or hr */
  storeCodes: string[];
  /** Shown under avatar */
  title: string;
  /** Timecard employee code (e.g. AS4) */
  employeeCode?: string | null;
  /** Timecard designation / job title */
  designation?: string | null;
};

export const AJ_STORES = [
  "DBC-GM",
  "VJ-VAL",
  "VJ-EAST",
  "VJ-OAK",
  "VJ-LIV",
  "VJ-SERRA",
  "VJ-SAL",
  "VJ-MOD",
  "DBC-STOCK",
  "VJ-ARDN",
  "VJ-ROSE",
  "VJ-FRE",
  "VJ-CHAND",
  "VJ-DEER",
  "VJ-BAY",
  "VJ-BAKER",
] as const;

/** @deprecated use AJ_STORES */
export const AKBER_STORES = AJ_STORES;

export const SHAUN_STORES = [
  "VJ-CULVER",
  "VJ-INLND",
  "VJ-ONT",
  "VJ-VICTOR",
  "VJ-PB",
  "VJ-NORTH",
  "VJ-PALM",
  "VJ-S.ANITA",
  "VJ-HEND",
] as const;

export const ADEEL_STORES = [
  "DE-SOUTH",
  "VJ-S.ROSA",
  "VJ-SOLANO",
  "VJ-RENO",
  "VJ-LONG",
] as const;

export const ROZINA_STORES = ["VJ-VIS"] as const;

function sheetUser(
  name: string,
  email: string,
  storeCodes: string[],
  passwordHash: string
): AuthUserRecord {
  return {
    username: email,
    name,
    email,
    passwordHash,
    role: "employee",
    storeCodes,
    title: AUTH_ROLE_LABEL.employee,
  };
}

const USERS: AuthUserRecord[] = [
  {
    username: "kash",
    name: "Kash Valliani",
    passwordHash:
      "$2b$10$OOR0KpMPwlmJVTYq6XEZ1ewnj8cTHd8GQec/dS3C90al8axjElReq", // Kash-Valliani
    role: "admin",
    storeCodes: [],
    title: "Founder & President",
  },
  {
    username: "aj",
    name: "AJ",
    passwordHash:
      "$2b$10$jJOVYmYvNxqCNyMon31GVu/65jMjPqxnYTOmo7QcWLjXq25AmRlFC", // AJ-Valliani
    role: "dm",
    storeCodes: [...AJ_STORES],
    title: "District Manager",
  },
  {
    username: "shaun",
    name: "Shaun McCullough",
    passwordHash:
      "$2b$10$osp08e.v5x3cWWCVzrDAseA7NDUveOAn5Xy3Qa62mB8O72JXGXAka", // Shaun-Valliani
    role: "dm",
    storeCodes: [...SHAUN_STORES],
    title: "District Manager",
  },
  {
    username: "adeel",
    name: "Adeel Valliani",
    passwordHash:
      "$2b$10$fbYMCo9.e.CPpQp0DUrZXeQ9PSf1DKKTSXbakOtcLkk94rmYBD/Xm", // Adeel-Valliani
    role: "dm",
    storeCodes: [...ADEEL_STORES],
    title: "District Manager",
  },
  {
    username: "rozina",
    name: "Rozina Kassam",
    passwordHash:
      "$2b$10$OBpALP1RdZwVEQxVzl61JevYdrYcaDp521ZWmMndRQzJP4tvqRa7W", // Rozy-Valliani
    role: "dm",
    storeCodes: [...ROZINA_STORES],
    title: "",
  },
  {
    username: "ross",
    name: "Ross K",
    passwordHash:
      "$2b$10$T8O/8kBzGyqCdcJszmf9jO6p6HvRCum.yQ.ekReIaU9fFcu8YSqgK", // Ross-Valliani
    role: "admin",
    storeCodes: [],
    title: "Global Director",
  },
  {
    username: "admin",
    name: "Admin",
    email: "admin@valliani.app",
    passwordHash:
      "$2b$10$aMWWghHGuuYquQhOwa/C5.is3zcSnW7hYUMpbDbuIzPenMrMaqzoO", // 123456
    role: "admin",
    storeCodes: [],
    title: "Administrator",
  },
  {
    username: "marina",
    name: "Marina",
    email: "marina@valliani.app",
    passwordHash:
      "$2b$10$0re7ulK8rth6OfrTygsvku8EKfyGsML2dbqT9dp2XcBkHNSPc5GMy", // 123456
    role: "admin",
    storeCodes: [],
    title: "Administrator",
  },
  sheetUser("Syed Muqeet Asim", "notfound1@gmail.com", ["NA"],
    "$2b$10$chUqWejxk0kIEi15ogDBN.FITWgb3Vun0wI.fU7MjAGT0QmoV.VIW"), // 123456
  sheetUser("Muhammad Aleem", "notfound2@gmail.com", ["VJ-OAK"],
    "$2b$10$2.Tqm9PVT9qHAVXkikBUseGmxwE8WOS8CFZMwnj9kNHhx.73Yui2e"), // 123456
  sheetUser("Akber Shaik", "notfound3@gmail.com", ["DBC-GM"],
    "$2b$10$h6wVgZA2wZYhhOZjxuvi8ueoGReTf64KsXY8PDKfHZSwL3vYxMD8."), // 123456
  sheetUser("Mohammad Azeem", "notfound4@gmail.com", ["NA"],
    "$2b$10$ZhSv7Voh96pAIGCCu.hNberMezl/m1DF.JsmFzm11rQhu4qhNeQMy"), // 123456
  sheetUser("Mohammad Akram", "notfound5@gmail.com", ["DBC-GM"],
    "$2b$10$A5x4RkO2SAPq2mMnjvpaz.ujrIzQ/K8WhawIdbG4LtSY/eqfF.SUC"), // 123456
  sheetUser("Sultan Ansari", "notfound6@gmail.com", ["VJ-SERRA"],
    "$2b$10$oO7C8wZowJn33GrT7pRZvuLiHW5X94TplWOCCOJIIMjiHwlb6nI5S"), // 123456
  sheetUser("Tayab Abdul", "notfound7@gmail.com", ["VJ-EAST"],
    "$2b$10$7t.ro1VMUaJCfx5XfCSbFu.TSTj5.wADKRXwl.m83LDlIyQQJ8E4u"), // 123456
  sheetUser("Acosta, Jesus A", "jesus@valliani.app", ["VJ-S.ANITA"],
    "$2b$10$qGtT2z8f1sT1g1dk9VD69.IQDNriuTqVnsInQtKA72IN.aQ0Oa1Sa"), // 123456
  sheetUser("Adnan, Sayed M", "adnan@valliani.app", ["NA"],
    "$2b$10$z2btkhAzSNJLIdVwRr7WUeHo6MZ3Qwk2K9YaCjik6cUTagNKxi5qW"), // 123456
  sheetUser("Ahmed, Shazia", "shazia@valliani.app", ["NA"],
    "$2b$10$HAi48YDwecxEhBG0dpNEBOhrthabZXKO4mgDpJrHbBgvYtHl1bK1."), // 123456
  sheetUser("Akhtar, Farah", "farah@vallianijewelers.com", ["NA"],
    "$2b$10$V19QeGTxHMSrpRT29Y9FHecfCPlsqqMgVMbNTd/Vt6Gcr3GXq2itW"), // 123456
  sheetUser("Al Ridwan, Md", "md@valliani.app", ["VJ-ONT"],
    "$2b$10$GI7yuJK9OPuqsIpN27muResUpUaDu4k1Plw2ZTWnOEpTPSk.rObqW"), // 123456
  sheetUser("Altaf, Fahad", "Fahad.A@valliani.app", ["VJ-OAK"],
    "$2b$10$qTG.MePu5vonH7hf7bHsdewxqcS/wj6i27GdtNeilgkBRN3W2UE7a"), // 123456
  sheetUser("Alvarez, Lynette L", "lynette@valliani.app", ["VJ-VAL"],
    "$2b$10$1YTGaWu0ZbI89NnZg69it.m73ZI7jkE2GdHQDMY073YI1evyn.KdO"), // 123456
  sheetUser("Aquino-Maya, Omar", "Omar.A@valliani.app", ["DBC-STOCK"],
    "$2b$10$3jkJal5svvSooNURwq.j2eTas91ddBExrG.KuB0Nljk2A6bzE484a"), // 123456
  sheetUser("Artani, Zoya", "zoya@valliani.app", ["VJ-VAL"],
    "$2b$10$M27OxZyIZnfYvtU6xTd76e3EluMsiKnYg4FZP5wqzg4ulKhjwUnJu"), // 123456
  sheetUser("Banuelos, Omar", "BanuelosO@valliani.app", ["VJ-ARDN"],
    "$2b$10$f8Exh8riXPw6BVhOJrCmoOi3zqb9XZjIQGVZGDX1fr4Bq6yd/DOga"), // 123456
  sheetUser("Barajas, Blanca Estela", "blanca@valliani.app", ["VJ-FRE"],
    "$2b$10$Wc6IDKqVtBEfEnPIcpPVuu8sVUeThC33yPHNOGvPlZmYlMwUujfEa"), // 123456
  sheetUser("Barcham, Shammeran Ben", "shammeran@valliani.app", ["DBC-STOCK"],
    "$2b$10$2U.wWrxbUliHMyN.dhJcRuLXWIto2KWTsml7jzEV.8QhBijjw06le"), // 123456
  sheetUser("Bermudez, Jocelyn R", "jocelyn@valliani.app", ["DBC-STOCK"],
    "$2b$10$7fDlgVg/FXov0T.bJMOZgu6e3h.bVmOH06O1ing8hN6/TzEMtEAfS"), // 123456
  sheetUser("Bermudez, Sonia", "sonia@valliani.app", ["VJ-ONT"],
    "$2b$10$wCYCDLCSUbsq05lbOsepFOtjE7DZQW7GZLWOcTnS.PHJNaP5WfnOa"), // 123456
  sheetUser("Biswas, Keya", "keya@valliani.app", ["VJ-ONT"],
    "$2b$10$vSteOpdNnMJ1e.IfVcNtTeu9aScuhDpZefxSg0AzZjOU2n9G0Ql3."), // 123456
  sheetUser("Bun, Sael", "sael@valliani.app", ["DBC-STOCK"],
    "$2b$10$nv3UzRg2SKSAbYYlwXWaiOZ2cXpwA848ttWVOksW7hBZ82gMUSWzi"), // 123456
  sheetUser("Camacho, Robert", "robert@valliani.app", ["VJ-BAKER"],
    "$2b$10$Ks058lXGXmndVp7pdHaAwujlyYa.ErrBSI8wUXyPLpttnMfY1W4Gi"), // 123456
  sheetUser("Castano, Valentina", "valentina@valliani.app", ["VJ-OAK"],
    "$2b$10$Tl7xwy0KJsvDFLbPz9YQaODk1STLL/opoXQ3zIxFJNPs6GdswKP7e"), // 123456
  sheetUser("Castanon Flores, Sayret", "sayret@valliani.app", ["VJ-BAKER"],
    "$2b$10$CNHl50cPMAbYGx.v3Tz.SOjrXdLJiTuUsrX/d.Z3ZULBj7iqf24mO"), // 123456
  sheetUser("Castrellon, Maribel", "maribel@valliani.app", ["VJ-PALM"],
    "$2b$10$10RacQ1Hj6EfEElPdXFd1uUCpDyGBdyuOzbgo4PR9g6QiATIQfG9y"), // 123456
  sheetUser("Cervantes, Gilberto", "gilberto@valliani.app", ["VJ-MOD"],
    "$2b$10$.Ll/JYrgU94PPzn8xOlegeJk5JVF9t7K2db1BUDA2Foyn0yYYZl/i"), // 123456
  sheetUser("Chavez, Mark A", "mark@valliani.app", ["VJ-PB"],
    "$2b$10$C6y49nziZV.V4TMd.McrOOPYrinZXIA5qk12PsgWucF3F4RtZAW.K"), // 123456
  sheetUser("Cheung, Liyi B", "lily@valliani.app", ["VJ-S.ANITA"],
    "$2b$10$dKt.g7JPq97Qy89oGX0J8eKr1RVpqmUPtdVA3VgBOcisFxirP4H1."), // 123456
  sheetUser("Chun, Lady Diana Andaya", "lady@valliani.app", ["VJ-LIV"],
    "$2b$10$NvJUd2gON32RxEpQv7z.Z.U0fCCiWprRDYnLLcfTnPuG/vtl9gfqi"), // 123456
  sheetUser("Cruz Lopez, Estefany C", "estefany@valliani.app", ["VJ-MOD"],
    "$2b$10$LpT4dV00dX1x2mTBO4AaPuSJjWpv1s0JjY7mNKsMAO1935PvBeTqC"), // 123456
  sheetUser("Dao, Anh", "anh@valliani.app", ["NA"],
    "$2b$10$ncyEHU1cXjA9jOG0nkvl/.DpXw5GxBrHyQOkyp0S6OkZ9Ii3QtDKO"), // 123456
  sheetUser("Das, Shila", "shila@valliani.app", ["VJ-INLND"],
    "$2b$10$PNVWG8btliqhYsfiwfZMUunQIgA08yXx/JGSHFxZo5oxphPvlGnOC"), // 123456
  sheetUser("De Guzman, Estelita M", "estelita@valliani.app", ["DBC-GM"],
    "$2b$10$XptT2GBNDzpq2VrxfbiL8OrKqgBnQR2oafi7/tSiihs4X1bw6WrgO"), // 123456
  sheetUser("Dy, Maria Cecilia Quirante", "notfound8@gmail.com", ["VJ-ONT"],
    "$2b$10$psW0XccJHU4dHTfJDFwVXu2eBKImtHdrqH2hjxzxgvONQN6sNQRXi"), // 123456
  sheetUser("Elizalde, Alexandra", "Alexandra_Elizalde@valliani.app", ["VJ-CULVER"],
    "$2b$10$tGXCDMj6SYFxJWaE..Guiua4w7it2GEvuw.Ku0wPqOsHs1RoHGrqK"), // 123456
  sheetUser("Emi, Mehjabeen S", "Emi@valliani.app", ["NA"],
    "$2b$10$mNULElckfjZho5wyjoedVek0KcWYyU126K/8PasVYYnivAJzsdQ86"), // 123456
  sheetUser("Esmail, Sarah A", "sarah@valliani.app", ["NA"],
    "$2b$10$KBjTTu4yEIuXOaUizehRoeyKBI9dI0htIOPaT8tpVTyUyx7ziOEom"), // 123456
  sheetUser("Evangelista, Karla M", "Karla@valliani.app", ["NA"],
    "$2b$10$IpUcSDpFJh0R1jaE2sE.C.0trnwljiv4v2qIZxf0LI9rAC3UktWai"), // 123456
  sheetUser("Faustino, Maria C", "Amy@valliani.app", ["VJ-SERRA"],
    "$2b$10$NFBdTkikZ/k.VuLTieGgEOEUrMDalagHU9fAElcSk13fRluEa9O5e"), // 123456
  sheetUser("Flores, Cristina", "cristina@valliani.app", ["DBC-STOCK"],
    "$2b$10$UzkN.3bD5vm8vY8tZFYDhuVe.XIZ9PgploragvViI.zfC.0dfZVBa"), // 123456
  sheetUser("Flores, Jorge A", "jorgef@valliani.app", ["VJ-MOD"],
    "$2b$10$MBed7v333O4Cftp1luI.aOe8p/GKB56lFKD9RwUAsVylNe.6i8fii"), // 123456
  sheetUser("Fuentes, Carlos Alberto", "carlos@valliani.app", ["NA"],
    "$2b$10$U1ls0TreY8VwlchSkq7jNuPYkwluMeU.26Qj2LiJOnQ.MIBaE4hhK"), // 123456
  sheetUser("Fuller, Liezl B", "liezl@valliani.app", ["VJ-PB"],
    "$2b$10$eizPYB8jMzl7ev/9luNho.6b.Mn/FZdGIjMtxjbB3fUc2YdByCuwK"), // 123456
  sheetUser("Garcia Espinoza, Teresa J", "teresa@valliani.app", ["VJ-MOD"],
    "$2b$10$ALr89MlNHAkr.r8coN0BVeouOo.E4KlY4pcD.VkaDkL6AkTW8.YbS"), // 123456
  sheetUser("Garcia, Adrina", "adrinagarcia@valliani.app", ["VJ-INLND"],
    "$2b$10$sSXsCSCQKBvnSh0kjIGAEeRCdNR2Hjd3XAWkI/stj5X/O2YErfufu"), // 123456
  sheetUser("Garcia, Jorge Perez", "jorgep@valliani.app", ["VJ-SERRA"],
    "$2b$10$uosMEwhS9Kvt0jX3HO3CPeG9XHKyZA3N6H0tmH0YKYn9g/vu6v3Hm"), // 123456
  sheetUser("Garcia, Lidia R", "lidia@valliani.app", ["VJ-OAK"],
    "$2b$10$GpFW.WMzCtYR3wFFhPQjaujkvbBq6paKwZyEkTFWSj0Ey5.FiYj8K"), // 123456
  sheetUser("Garcia, Roberto", "roberto@valliani.app", ["NA"],
    "$2b$10$PYa8vb/Z9.EaDYCaJx4qlehAcluN9l9tVF8TRc6B2mjUxMGRQWiJK"), // 123456
  sheetUser("Gomez, Roberto Carlos", "roberto.gomez@vallianijewelers.com", ["NA"],
    "$2b$10$OCKIjXdaoSeYVk0Xt..ire4iQlDi5tUn0vyFTdnpI0thZ4Z6i6XbW"), // 123456
  sheetUser("Gomez, Susana", "susana@valliani.app", ["VJ-PB"],
    "$2b$10$qOkvPFDN1YMaVBqc2PWaSen1yEu.z3dhaMiB7I9PAN0KRi6RD//UW"), // 123456
  sheetUser("Gowani, Faisal Mansoor Aly", "faisal@valliani.app", ["VJ-OAK"],
    "$2b$10$Qc3EWUYQHxV7wXuUWCJscek8DWeZ8Pjt4zA5VZxtf7cMWRK4/YRea"), // 123456
  sheetUser("Graybeal, Marina D", "marina.d@valliani.app", ["VJ-OAK"],
    "$2b$10$Q5erACwwaw7zCt2Ai3EB9uxiBiaxrrNut8C/an/dKZZ.5E9WBtLFC"), // 123456
  sheetUser("Harrison, Antonia Pereira", "antonia@valliani.app", ["VJ-CULVER"],
    "$2b$10$RoIw47qVU8PmYmldAQk4Be54As8dizuZI6rwu2fUx/rZqPw3uyFki"), // 123456
  sheetUser("Hernandez, Cecilia", "cecelia@valliani.app", ["VJ-PALM"],
    "$2b$10$wV37h5v9.PPEikNWzZ3vR.83tLM.0D1rLEw0g7czxCWfzIl.fN112"), // 123456
  sheetUser("Hester, Jami L", "jami@valliani.app", ["VJ-VICTOR"],
    "$2b$10$dcYziCGc8XPYqSOM9jxqte1LNGvRX3L0c4qoTcDrbBTvnxqEQLiAe"), // 123456
  sheetUser("Hossain, Mashrik MD", "mashrik@valliani.app", ["VJ-S.ANITA"],
    "$2b$10$Dcd06vg4KS/ZHjsAENv.tOTmDfnnuWJbl0SqG1ATyEtF.xKqFihWq"), // 123456
  sheetUser("Huynh, Anh", "AnhH@valliani.app", ["VJ-FRE"],
    "$2b$10$NxdDjQyq5Lp.qM.S3yL.uunBp3d4fGpcWJFhvjsiaQ97G4ImPd3g."), // 123456
  sheetUser("Ibarra, Fransisco J", "fransisco@valliani.app", ["VJ-PB"],
    "$2b$10$NFTphrxoo09Vp2wCAFHBh.yX74lpnq8ufTMpRusEJC2I0VZ5tIeta"), // 123456
  sheetUser("James Anthony, Guzman", "james@valliani.app", ["VJ-PALM"],
    "$2b$10$NgESlzDO6BSIrWfp10g/EOCrS4KzwygWwor80/ZR8VLZmnrNjaPLy"), // 123456
  sheetUser("Jasso Ledezma, Arturo", "ArturoJ@valliani.app", ["VJ-BAKER"],
    "$2b$10$xcBqjTbH.C.c4NxtIhXHoOB0YFqUPjqJNodnfo7wbKcM3fprpnSka"), // 123456
  sheetUser("Javer, Vannalyn Santos", "vannalyn@valliani.app", ["NA"],
    "$2b$10$1WF5iDkBJYGc4ckdcOryJ.noPQGEST92rFcbkHU.57lANcs/gGx4a"), // 123456
  sheetUser("Jimenez, Arturo", "arturo@valliani.app", ["VJ-LIV"],
    "$2b$10$NkZJb60tQZElyaOdHqIO7eNnvu0k6aFk9ujnVL7CJCt0sc4fm5Tde"), // 123456
  sheetUser("Jimenez, Diana L", "l.@valliani.app", ["VJ-EAST"],
    "$2b$10$2LVKxtN6aUaFasOLFDxtb.3wPmVoAQpuzmQAqTIujKQdotZAnfyDG"), // 123456
  sheetUser("Jivani, Akberali S", "akber@valliani.app", ["NA"],
    "$2b$10$TkBFKUBG7kqdp/i10COro.L47L4zKwbnNGW/qtTwhZh.Unn.d62e2"), // 123456
  sheetUser("Jivani, Fayaz", "fayaz@valliani.app", ["NA"],
    "$2b$10$D/awKzfb/8QrZya2BuyY5eHTTH7rvVy4YnausAiXd3b5SXBMghdVO"), // 123456
  sheetUser("Jot, Divy", "divy@valliani.app", ["VJ-NORTH"],
    "$2b$10$we.Bm7tceEDwfl4cIFHjrO1ImjfNfGyera7VBL8kuZH3ZR5VCtMC."), // 123456
  sheetUser("Juarez, Rosa V", "rosa@valliani.app", ["VJ-INLND"],
    "$2b$10$giL9TQ9JpHr9ALC5EPaXQeYU.UvyVXPvx1GBJro8OxOIwR5fLrMy2"), // 123456
  sheetUser("Kainth, Tarvinder", "tarvinder@valliani.app", ["VJ-LIV"],
    "$2b$10$R0t4PpMDWAjKqurBordlS.hjxgD8o4LpGM6TulIqNap..PBPjL5NC"), // 123456
  sheetUser("Karakouzian, Lucy", "lucy@valliani.app", ["VJ-S.ANITA"],
    "$2b$10$w42JMBAi1YmT1sxQPIJY1eKJGNF6.eFA4TyDVhayC7Tn2VWjmvmfa"), // 123456
  sheetUser("Khamo, Maryam S", "maryam@valliani.app", ["VJ-ROSE"],
    "$2b$10$mpxir4X2tVaw2LvhDtC6yeoLFjCEWZdVhr/p9Tg4THH2uyVmO5qMe"), // 123456
  sheetUser("Khanam, Mahmuda", "mahmuda@valliani.app", ["VJ-VICTOR"],
    "$2b$10$mYPjQVun4lrzwgGSN0Di2.n/a2nUIpD3GW5wwKumOkicxb0.a9vFu"), // 123456
  sheetUser("Khowaja, Sulleman", "notfound9@gmail.com", ["NA"],
    "$2b$10$1uo5nDfpbV82Dj0DTbn85.Q.CCAhal7gmI2OOcyuIskC.Et8y2yVi"), // 123456
  sheetUser("Kumar, Shubham", "shubham@valliani.app", ["VJ-FRE"],
    "$2b$10$guNM8GqjovgQ.6h.Ta2GWObBRgUNLviz.5ZdphracwVkMTmyUdcli"), // 123456
  sheetUser("LNU, Mukesh Kumar", "mukesh@valliani.app", ["VJ-MOD"],
    "$2b$10$zmfXMRF5wzTc8hMSpJF51uvxkRY2/vw12uGPJmygQTkcVHG1gYL5q"), // 123456
  sheetUser("Lai, Duc Kim", "duc@valliani.app", ["NA"],
    "$2b$10$K7olXkd.Pb4iTZpuZviiveXgi0Mz98NWHFwDvXEN/mIuTxWN46ytW"), // 123456
  sheetUser("Le, Thanh Q", "notfound10@gmail.com", ["NA"],
    "$2b$10$e2aV1.8WoaaNOYaWZmW75OSxWajBWePqP/zm6p571wslorZ9tI4TS"), // 123456
  sheetUser("Le, Vu N", "VuN@valliani.app", ["DBC-GM"],
    "$2b$10$TkCfFip4KWpbnJFCgXb7yesRudYiKqNeqcgl/0ElNvTAPKynoFbkK"), // 123456
  sheetUser("Leon Gomez, Elizabeth", "Elizabeth@vallianijewelers.com", ["NA"],
    "$2b$10$sJYm.U9XqHjWNtIDhw1bPuCzAI7sj5lP/v3bwFa8qymyMVrYsz10."), // 123456
  sheetUser("Li, Bei", "bei@valliani.app", ["VJ-ONT"],
    "$2b$10$fWs99vEwr2ZXfKKf9TpwyuAF6EXKkxdrIx5ua7SKt3DDQm/OS3tJa"), // 123456
  sheetUser("Lnu, Mohammed Abdul Muqueeth", "notfound11@gmail.com", ["DBC-GM"],
    "$2b$10$BvmuNX9OE967SRvuanaG6OZ11HWjNY3FcsGM0Nl.to/rqWqIHIeEK"), // 123456
  sheetUser("Lumba, Christina", "christina@valliani.app", ["VJ-PALM"],
    "$2b$10$MDHSw62cJ0zttl/sYUxrS.LXvd4Cbe.qtO1ifQDRtlwtEdfpAOrjK"), // 123456
  sheetUser("Ma, Ronnie M", "ronnie@valliani.app", ["VJ-ROSE"],
    "$2b$10$3qAdfkDxZ6iUyStv9h8kZessG5YPlPZSBnxf29zAw/hMtoqJ07tsK"), // 123456
  sheetUser("Maldonado, Rosela", "rosela@valliani.app", ["VJ-ONT"],
    "$2b$10$uFEcmB9Af4foXeVTuGgF7u12JaG.VBQBf4ygPmJSA43h0HgK5l8AG"), // 123456
  sheetUser("Manapsal, Julia F", "julia@valliani.app", ["VJ-LIV"],
    "$2b$10$PTEg.ofKiPf4ZwKaHmWBWe6oW76RWkuFjeEyQmoMzzoL1f3HQbJAC"), // 123456
  sheetUser("Martinez, Filemon", "filemon@valliani.app", ["VJ-OAK"],
    "$2b$10$v3int2NvCXgLop77RFEOreSb5CY1uLcfgFUCFXDHxMMvempWe30Ja"), // 123456
  sheetUser("McCullough, Shaun A", "shaun@valliani.app", ["NA"],
    "$2b$10$OP/OXuDrVzCpzhIekLISD.MVdi2kZzf35cpZAKoCrNtxIxMmln/Hm"), // 123456
  sheetUser("Meenawala, Mohammed Faisal Khan", "notfound12@gmail.com", ["NA"],
    "$2b$10$CP8Ao6yIl32l5FiQkLoHfefyQ/Pe8mvIolMvzWrgn/KxOgEnHtGyq"), // 123456
  sheetUser("Mirza, Taufiq", "taufiq@valliani.app", ["VJ-VICTOR"],
    "$2b$10$uw0eSKj1Vug2SbnjVKEQFeLSJkxft9aW/oQM7x76J.RFM0vvBT9p6"), // 123456
  sheetUser("Morales, Maria C", "MariaC@valliani.app", ["VJ-MOD"],
    "$2b$10$nmz.40aVE7HoZK3xXz1VSO8Hb6SuLHG9kxrAwRvOo0XnhkrfbnmgW"), // 123456
  sheetUser("Munoz, Camille Keiyl Supan", "camille@valliani.app", ["DBC-STOCK"],
    "$2b$10$qHembV2fE5ajzpa/5f9M2.HNHTWI4fO8L1Zd0mEuCCK96y.oQvabW"), // 123456
  sheetUser("Naimi, Yama", "yama@valliani.app", ["VJ-ARDN"],
    "$2b$10$en/PqKklzC4KKoaiE/khyeTmHBHBnPG7rPTnFMgIqRHppNFMg6sRu"), // 123456
  sheetUser("Nakhwa, Shakib", "shakib@valliani.app", ["VJ-ARDN"],
    "$2b$10$QW/SLi8EeRowQXDKpVVUpOaiviP05fU9mgsEjxzAPE6/Ai9qqxQNa"), // 123456
  sheetUser("Navarro Hernandez, Wilson I", "wilson@valliani.app", ["VJ-CULVER"],
    "$2b$10$0si5Z9RkjJlDaf/7L.Gi7OK9BbBfBTZ2Gge.fIQD/7Gh7A9R4lUw6"), // 123456
  sheetUser("Nawabi, Zarifa", "zarifa@valliani.app", ["VJ-VAL"],
    "$2b$10$tw8aYv/x.DpeYEHX67niSuz8H6MNGAFJnX.XMsrUSrD91xkX4qkTW"), // 123456
  sheetUser("Nguyen, Hung S", "hung@valliani.app", ["VJ-SERRA"],
    "$2b$10$fKug5b8LL2XoN9VJhw.eeeKdC9CdzTyfHVFuLviRlWNNhRAvmG.ei"), // 123456
  sheetUser("Noriega Cruz, Iliana", "iliana@valliani.app", ["VJ-SAL"],
    "$2b$10$t4dDFK8wQId0w.woPhOFYOr6MRDUEhJODFmXV1qXYydO4/kz2nY4m"), // 123456
  sheetUser("Nunez, Cristal A", "cristal@valliani.app", ["NA"],
    "$2b$10$yhvcHkxdTayMMLOwU...duvWMQF6hrS091TcoXwKr1iXGrvpOncTi"), // 123456
  sheetUser("Ochoa, Cynthia", "cynthia@valliani.app", ["VJ-SAL"],
    "$2b$10$AzOmfZfT4/ImTSksVDr4JOFOel8QRKffBNr4kRHPsreksc/kJJo/q"), // 123456
  sheetUser("Orellana, Paola Sarai", "paola@vallianijewelers.com", ["NA"],
    "$2b$10$5cudmnaA0EjrrtvI1TT2U.pEF4.QyLBZbXAiynZJvNDlKW293wf1u"), // 123456
  sheetUser("Pacheco, Patricia", "patricia@valliani.app", ["VJ-MOD"],
    "$2b$10$70M5CoaeGURXAGmtIFAy2ufCNWHIa6CSLugkPzjPd9y5wXzrpcvdm"), // 123456
  sheetUser("Paclibar, Maria S", "MariaS@valliani.app", ["VJ-ARDN"],
    "$2b$10$Sf0jCOurcCkdP7N5GjsK/.wFFDdgGr1oAIhHZRC1gWgJoQ1Hxxv5K"), // 123456
  sheetUser("Panelo, Cristina A", "Cristina.Panelo@valliani.app", ["VJ-EAST"],
    "$2b$10$gduyiPqSpBL5qwnvzsrFs.zELlimKGk.VGClamdy98p3yws3gBJIi"), // 123456
  sheetUser("Phoolwala, Fahad F.", "fahad@valliani.app", ["VJ-LIV"],
    "$2b$10$qo/GcEqJivwRYBp4u0GtxuTnmygaGd42ed9hGlKLQGJuTDPcOOW7q"), // 123456
  sheetUser("Politron, Maria Valeria", "MariaP@valliani.app", ["VJ-SAL"],
    "$2b$10$bIKDnm/h8ZYFh2tNgLedBOYhUPHhQnuQ8Wfas8Pgo/ZT2NQBQwnK."), // 123456
  sheetUser("Preciado, Angelique Celina", "angeliquecelina@valliani.app", ["VJ-VICTOR"],
    "$2b$10$jrS88ED0LiNwSI9ANeu.xeBYJxNAc/U8cIublIXq4hTrUOjNxi.Z6"), // 123456
  sheetUser("Ramirez Garcia, Jorge", "jorge@valliani.app", ["VJ-NORTH"],
    "$2b$10$xUnR7tuaVGiSEdnSj5RgX.khwq1.ovDFflwJwpZ9kpXJhWn2RVNu6"), // 123456
  sheetUser("Ramirez, Araceli", "araceli@valliani.app", ["VJ-BAKER"],
    "$2b$10$cwtg5qHuaY3eBWqG4cXYIe4hgyEleTEAQKxIEpzXmoaPqCseOI/82"), // 123456
  sheetUser("Ramirez, Javier", "ramirez@valliani.app", ["VJ-ROSE"],
    "$2b$10$8rpWt5l2YPZ5WtO.YWiElOHndEbgSEkPdNfLs48QVnzHQ5io7d6GC"), // 123456
  sheetUser("Renteria, Rafael", "rafael@valliani.app", ["NA"],
    "$2b$10$9og0zaGY74Reev2waerUFOVS1j8iS49HrRUNY6sH3ptKloCNxgZau"), // 123456
  sheetUser("Repair, Pete'S", "pedro@valliani.app", ["DBC-STOCK"],
    "$2b$10$EImYKNulbWL1B5F5PLQcn.LgFAjGRGbqWZPH8gtBu0k4waXbSKQPi"), // 123456
  sheetUser("Reyes, Alexandra", "Alexzandra@valliani.app", ["VJ-VICTOR"],
    "$2b$10$rtwKVNax.85W/ZE2hvu7yuRO1jLXaVGZbz1YzRpWBsFRxmZ66m4WO"), // 123456
  sheetUser("Reyes, Mary Jane B", "maryjane@valliani.app", ["VJ-NORTH"],
    "$2b$10$uPwjZt5z1sTFY5pJmjPNyO.1f9dmMTWZKV7BbJGiAccJQrYw34lk6"), // 123456
  sheetUser("Rodriguez, Carmen R", "carmen@valliani.app", ["VJ-OAK"],
    "$2b$10$SdJGhX8doxUDWUBg/5HaNeQjbafPfO76815KjnjYMXD/q.pGc7ZYq"), // 123456
  sheetUser("Rosales-Gutierrez, Steven A", "steven@valliani.app", ["VJ-CULVER"],
    "$2b$10$SXmUdwn53iYRGFgdQnsnL.Yq8iX1/efJxSP6UPkJRiknX9dVl9p6y"), // 123456
  sheetUser("Samararathnage, Lalith G", "lalith@valliani.app", ["VJ-SAL"],
    "$2b$10$VYTwB.mttCozftsbVu0jOOBCQYbs7qmDfhP.f8tMeYvwEkYMEqU86"), // 123456
  sheetUser("Sanchez Rojas, Elbardo", "elbardo@valliani.app", ["VJ-BAKER"],
    "$2b$10$Dllo9/oTi7gio1Mca8caVub3osEzuwzfSoniRwL5QM/Csue5SGHlu"), // 123456
  sheetUser("Sanchez, Teresa A", "Teresa.Sanchez@valliani.app", ["NA"],
    "$2b$10$b9xJLe6rB4YrCQb.rTcrSeZqW22vZCx4SMdTtaqCnJZzpPbWD9L8i"), // 123456
  sheetUser("Sekhon, Jason", "jason@valliani.app", ["VJ-FRE"],
    "$2b$10$EmdGhNFk1Ztgxtn/rTMfa.jR6IUdOMlbhTPrRyDHiC8Zcz2lso5Cu"), // 123456
  sheetUser("Shah, Janvi Atul", "notfound13@gmail.com", ["NA"],
    "$2b$10$dfTzSPI4ARNhNbSdf/zeo.5p/yqCwHSc1wqcKSd3mtCDOrfbLWRYW"), // 123456
  sheetUser("Shehryar, Hussain", "shehryar@valliani.app", ["VJ-BAKER"],
    "$2b$10$n/r78ZYpmY7gZavNE4zXiOonME2sR7X/X1BK/NqacSvcD24Oiz21G"), // 123456
  sheetUser("Shipp, John P", "john@valliani.app", ["VJ-SAL"],
    "$2b$10$451.mzVnCl6OPCRI4sAKD.IZXXrchb42oUSTzzmp/bLQNGHGVVJfW"), // 123456
  sheetUser("Siddiq, Mohammad O", "mohammad@valliani.app", ["VJ-ROSE"],
    "$2b$10$6DccJsqn0xLVypmManv1U.VcweDl64JVlvrZgsnqcLGqN1bNeerrC"), // 123456
  sheetUser("Silva, Aurelia R", "aurelia@valliani.app", ["VJ-EAST"],
    "$2b$10$mOVCCCvtVrMHe2XwzdNr1.BbxGIR.Z/B6dnrJmuqOisR1S1vwKD0."), // 123456
  sheetUser("Soriano, Tody C", "tody@valliani.app", ["DBC-GM"],
    "$2b$10$gLF/6Gjv1RsVu61VaxpN7.7dJ9GBUgGifr1q074YscJfyDOsaUGLq"), // 123456
  sheetUser("Talavera, Leslie A", "leslie@valliani.app", ["VJ-BAKER"],
    "$2b$10$P.tbPeO0Abp.2g4AX895K.o0h5CBWABjBj60k8M3Sp3uYEB20LpnS"), // 123456
  sheetUser("Tanvir, Muntasir", "muntasir@valliani.app", ["VJ-CULVER"],
    "$2b$10$ipNRqB.fZZHNnlOZ5CaY8uErIX7lvPCrL7tHtPOedyNdezugtZNFO"), // 123456
  sheetUser("Thammavong, Deena A", "deena@valliani.app", ["VJ-ROSE"],
    "$2b$10$UkRK.el/l5V/SpzvxkDTMenyRi7271tbQTwhIx.1dMYDiwOiPm3l2"), // 123456
  sheetUser("Thind, Simran", "simran@valliani.app", ["VJ-BAKER"],
    "$2b$10$WgMjPjj4/NkaNayBhgKO5e4Ml9Us5Ko0GAxE7EwM6B9hlP8uMCUU6"), // 123456
  sheetUser("Thomas, Jessica N", "jessica@valliani.app", ["VJ-FRE"],
    "$2b$10$Qg8.J4wIheCsg/GJLM3eW.kRU4tXqg8Cc6X6d21sdVReRATe3QYS."), // 123456
  sheetUser("Torres Lopez, Vivian", "vivian@valliani.app", ["VJ-PB"],
    "$2b$10$lVPWm1uNktevpJs7s6VKW.E0pJCGZRgIS5OpzJYp6cCISmyE6iJe6"), // 123456
  sheetUser("Torres Lozano, Andrea B", "andrea@valliani.app", ["VJ-VAL"],
    "$2b$10$A/kbUFXvI93mj2QNPuiBYezfUd2ePdDpgXcwzXNfCMyYzwpZyBCfW"), // 123456
  sheetUser("Trinidad, Maria U", "beth@valliani.app", ["VJ-SERRA"],
    "$2b$10$IH/JQIKKIj2Nm4lXiXQFaeJlOpmy4reWuiJYjsIdqVhpV.vO00hU2"), // 123456
  sheetUser("Valichetty, Ruchitha", "ruchitha@valliani.app", ["VJ-PALM"],
    "$2b$10$/qITQBdzk5acYszm.hmuAOaHdM0qjhD/.UK/uHifwRo5uIozsOyUm"), // 123456
  sheetUser("Vargas, Angelica", "angelica@valliani.app", ["VJ-EAST"],
    "$2b$10$zm/oMGAjP9ekmQMsu/zUJubaV8P3kdi8YCrYVGBSScRFm4ikP2FAG"), // 123456
  sheetUser("Vilchis, Maria De Lourdes", "mariad@valliani.app", ["VJ-FRE"],
    "$2b$10$yuWX9GlVJ31F1glQT0YOr.THCV.2yyGMXecz84aTEz39d2Zc1Wonq"), // 123456
  sheetUser("Ward, Amelita C", "amelita@valliani.app", ["VJ-ROSE"],
    "$2b$10$ZRhL1KuAbkAyldOeOEJ80OrI5g3wj0muZIpqqsGvLIQ6BmC/js7n."), // 123456
  sheetUser("Zarate, Omar Na", "omar@valliani.app", ["VJ-INLND"],
    "$2b$10$x9SnTF8W6HvBojck1DpuKeu0HYNCd.MlgXrtEF8.6LQrMSiLecR0m"), // 123456
  sheetUser("Zelaya, Josue", "Josue@valliani.app", ["NA"],
    "$2b$10$abrwSK.dr8xsst2yF1NWUucjuAQZC6b4NEJAnQXdmQPID8SvRqxS."), // 123456
];

function parseEnvUsers(): AuthUserRecord[] | null {
  const raw = process.env.AUTH_USERS_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthUserRecord[];
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return parsed;
  } catch {
    console.warn("AUTH_USERS_JSON is invalid JSON — falling back to built-in users");
    return null;
  }
}

function withGuardDisplayNames(users: AuthUserRecord[]): AuthUserRecord[] {
  return users.map((user) => {
    const name = resolveHrEmployeeDisplayName(user.name);
    return name === user.name ? user : { ...user, name };
  });
}

export function listBuiltinAuthUsers(): AuthUserRecord[] {
  return withGuardDisplayNames(USERS);
}

export function listAuthUsers(): AuthUserRecord[] {
  return withGuardDisplayNames(parseEnvUsers() ?? applyUserDirectory(USERS));
}

export function findAuthUser(username: string): AuthUserRecord | null {
  const alias = normalizeUsername(username);
  return (
    listAuthUsers().find((u) => {
      if (normalizeUsername(u.username) === alias) return true;
      if (u.email && normalizeUsername(u.email) === alias) return true;
      if (normalizeUsername(u.name) === alias) return true;
      return false;
    }) ?? null
  );
}

export function getAllowedStoreCodes(user: AuthUserRecord): string[] | null {
  if (user.role === "admin" || user.role === "hr") return null;
  return user.storeCodes;
}

/** DMs — leftover per-user matrix helper. Admins / HR use role permissions. */
export function isPermissionMatrixUser(user: AuthUserRecord): boolean {
  return user.role === "dm";
}

export function listPermissionMatrixUsers(): AuthUserRecord[] {
  return listAuthUsers().filter(isPermissionMatrixUser);
}

/** Rozina default / client fallback — server APIs use hidesVendorInfoFromPermissions. */
export function hidesVendorInfo(username: string | null | undefined): boolean {
  return (username ?? "").trim().toLowerCase() === "rozina";
}
