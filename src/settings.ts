export enum Job {
    FrontEnd = 1,
    FullStack = 2,
    WebGL = 3,
    Modeler = 4,
    DesignSystem = 5,
}

export const JobMap = {
    1: "Front End",
    2: "Full Stack",
    3: "WebGL",
    4: "3d Modeler",
    5: "Design System",
}
  
// One page of the project viewer carousel. Every field is optional (e.g. only an image).
// text supports *bold*, _underline_ and \n, image is a path inside /public (e.g. 'img/projects/popin_1.png')
// width is any CSS width relative to the carousel (e.g. '50%', '320px'), defaults to --pv-slide-width in App.css
// video is a path inside /public (e.g. 'video/projects/popin_1.mp4'), only shown in the showcase detail page (muted, looped)
// cover: true makes the slide's video (or image) the one shown in the showcase carousel, and hides the slide everywhere else
export interface ProjectSlide {
    title?: string,
    text?: string,
    image?: string,
    video?: string,
    width?: string,
    cover?: boolean,
}

// What the showcase carousel shows for a project: its cover slide, then video (a muted loop,
// e.g. 'video/projects/popin.mp4'), then the first slide image, then a generated title card.
export interface ProjectType {
    name: string,
    url: string,
    jobs: Job[],
    description: string,
    awarded?: boolean,
    video?: string,
    slides?: ProjectSlide[],
}

export const projects: ProjectType[] = [
    {
      name: 'Popin_', url: 'https://popingroup.com', jobs: [Job.FullStack, Job.WebGL], awarded: true,
      description: "Fun website to display popin's campaigns. I designed the project architecture and implemented the _frontend_ and _backend_.",
      slides: [
        { video: 'video/popin.mp4', cover: true },
        { title: 'Overview', text: "Fun website to display Popin's campaigns.\n\nThe client wanted something playful and engaging.", width: "30%" },
        { image: 'img/projects/popin1.png' },
        { width: "30%", title: 'My role', text: 'I designed the project architecture and implemented the frontend and backend using _Wordpress_ as a _headless CMS_.' },
        { image: 'img/projects/popin2.png' },
        { image: 'img/projects/popin3.png' },
      ],
    },
    {
      name: 'Dianelum', url: 'https://dia.pre-lanegrita.es', jobs: [Job.FrontEnd, Job.WebGL, Job.Modeler],
      description: '3D immersive web experience to showcase how laboratory diamonds are made. I worked on the 3D part of the project, creating a realistic and interactive 3D environment using _Three.js_ and _WebGL_ with _React_ + _Typescript_.',
      slides: [
        { video: 'video/dianelum.mp4', cover: true },
        { image: 'img/projects/dianelum1.jpg' },
        { title: 'Overview', text: '3D immersive web experience to showcase how laboratory diamonds are made.' },
        { image: 'img/projects/dianelum2.jpg' },
        { title: 'My role', text: 'I worked on the 3D part of the project, creating a realistic and interactive 3D environment.' },
        { image: 'img/projects/dianelum3.jpg' },
        { title: 'Stack', text: 'Built with _Three.js_ and _WebGL_ on top of _React_ + _Typescript_.' },
        { image: 'img/projects/dianelum4.jpg' },
      ],
    },
    {
      name: 'GOfit Design System', url: 'https://bitcente.com/lololopez/', jobs: [Job.FrontEnd, Job.DesignSystem],
      description: 'A personal portfolio website showcasing Lolo López\'s work.\n Heavily focused on animations and user experience being as interactive as possible using _GSAP_.',
      slides: [
        { video: 'video/triptico1.mp4', cover: true },
        { title: 'Overview', text: 'A personal portfolio website showcasing Lolo López\'s work.' },
        { title: 'Focus', text: 'Heavily focused on animations and user experience, being as interactive as possible using _GSAP_.' },
      ],
    },
    {
      name: 'Lolo López', url: 'https://bitcente.com/lololopez/', jobs: [Job.FrontEnd],
      description: 'A personal portfolio website showcasing Lolo López\'s work.\n Heavily focused on animations and user experience being as interactive as possible using _GSAP_.',
      slides: [
        { video: 'video/lololopez.mp4', cover: true },
        { title: 'Overview', text: 'A personal portfolio website showcasing Lolo López\'s work.' },
        { title: 'Focus', text: 'Heavily focused on animations and user experience, being as interactive as possible using _GSAP_.' },
      ],
    },
    {
      name: 'Switzerland Trains', url: 'https://grandesmiradores.myswitzerland.com', jobs: [Job.FullStack],
      description: 'A comprehensive platform for exploring Switzerland\'s train routes. Developed the _full-stack_ module-based solution using _Wordpress_ and _ACF_.',
      slides: [
        { title: 'Overview', text: 'A comprehensive platform for exploring Switzerland\'s train routes.' },
        { title: 'My role', text: 'Developed the _full-stack_ module-based solution using _Wordpress_ and _ACF_.' },
      ],
    },
    {
      name: 'Macenas Resort', url: 'https://www.macenasresort.com', jobs: [Job.FullStack],
      description: 'A modern website for the Macenas Resort, highlighting its amenities and services. _Full-stack_ project with extreme _SEO_ optimization work behind it.',
      slides: [
        { title: 'Overview', text: 'A modern website for the Macenas Resort, highlighting its amenities and services.' },
        { title: 'My role', text: '_Full-stack_ project with extreme _SEO_ optimization work behind it.' },
      ],
    },
  ]
  
export interface SkillType {
    name: string,
    img: string,
    modalDescription: string,
}
  
export const skills: SkillType[] = [
    { name: 'React', img: 'react.png', modalDescription: `
      <span class="green-3">useEffect(() => {</span><br>
      <br>
      <p>
        My main framework right now, it has everything I need to build even the smallest project. And it also has a dedicated renderer for Three.js!
        <br>This portfolio was made using React with help from some libraries like zustand for state management and gsap for javascript animations.
      </p>
      <br>
      <span class="green-3">}, [])</span>
    ` },
    { name: 'Figma', img: 'figma.png', modalDescription: `
      <span class="green-3">const Figma = (design: string) => {</span><br>
      <br>
      <p>
        Component based design system that allows me to create and maintain a consistent visual language across all my projects. I use it to create wireframes, prototypes, and high-fidelity designs.
      </p>
      <br>
      <span class="green-3">}</span>
    ` },
    { name: 'Typescript', img: 'typescript.png', modalDescription: `
      <span class="green-3">const Typescript = (state: string) => {</span><br>
      <br>
      <p>
        My current main language for building websites. Scalable, secure and I can define types, it's <span class="highlight">perfect<span>!
      </p>
      <br>
      <span class="green-3">}</span>
    ` },
    { name: 'ThreeJS', img: 'threejs.png', modalDescription: `
      <span class="green-3">function ThreeJS() {</span><br>
      <br>
      <p>
        It's what I use to create stunning 3D graphics and animations. Even if the project does not need 3d models to be seen on screen I still try to use it make the web feels smooth and innovative.
      </p>
      <br>
      <span class="green-3">}</span>
    ` },
    { name: 'Sass', img: 'sass.png', modalDescription: `
      <span class="green-3">#Sass {</span><br>
      <br>
      <p>
        It's like having superpowers that make my CSS coding faster and more maintainable. I use it mostly in big and scalable projects to make sure that all developers will stay on the design system.
        <br><br>
        <span class="green-3">.BEM {</span><br><br>
        <p class="secondary">
          I also use bem methodology to reuse components and speed up the coding process.
        </p>
        <p>
        <br>
        <span class="green-3">}</span>
      </p>
      </p>
      <br>
      <span class="green-3">}</span>
    ` },
    { name: 'AI', img: 'ai.png', modalDescription: `
      <span class="green-3">--- Start of Prompt ---</span><br>
      <br>
      I use AI to work more efficiently by speeding up problem-solving, generating boilerplate code, catching bugs early, and exploring <span class="highlight">better solutions faster</span>.
      <br><br>
      It helps me focus more on designing great systems instead of getting stuck on repetitive tasks.

      <br>
      <br>
      <span class="green-3">--- End of Prompt ---</span><br>
    ` },
]


export interface ExperienceType {
  job: string,
  company: string,
  companyUrl: string,
  start_time: string,
  end_time: string,
  location: string,
  modalDescription: string,
}

export const experienceList: ExperienceType[] = [
  {
    "job": "Frontend Software Engineer",
    "company": "Telefónica",
    "companyUrl": "https://www.telefonica.com/en/",
    "start_time": "Feb 2024",
    "end_time": "Present (" + ((d, m = (d.getFullYear() - 2024) * 12 + d.getMonth() - 1) => `${Math.floor(m / 12)} years ${m % 12} months`)(new Date()) + ")",
    "location": "Remote",
    "modalDescription": ""
  },
  {
    "job": "Creative Software Developer",
    "company": "La Negrita Studio",
    "companyUrl": "https://lanegrita.es",
    "start_time": "Sep 2021",
    "end_time": "Feb 2024 (2 years 6 months)",
    "location": "Murcia, Spain",
    "modalDescription": ""
  },
];

export interface StudiesType {
  name: string,
  location: string,
  start_time: string,
  end_time: string,
  modalDescription: string,
}

export const studiesList: StudiesType[] = [
  {
    "name": "Three.js Course",
    "location": "ThreeJS Journey",
    "start_time": "Dec 2022",
    "end_time": "Apr 2023",
    "modalDescription": ""
  },
  {
    "name": "Web Application Development Higher Degree",
    "location": "IES José Planes, Spain",
    "start_time": "Sep 2019",
    "end_time": "Jun 2021",
    "modalDescription": ""
  },
];