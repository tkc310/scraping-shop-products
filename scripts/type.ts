type Common = {
  name: string;
  price: string;
  code: string;
  size: string;
  url: string;
};

export type Cando = Common;

export type Watts = Common & {
  packageSize: string;
};

export type Product = Cando | Watts;
