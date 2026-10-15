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
    // live project, without it there's no "Visit project" button
    url?: string,
    jobs: Job[],
    description: string,
    awarded?: boolean,
    video?: string,
    slides?: ProjectSlide[],
}

export const projects: ProjectType[] = [
    {
      name: 'Dianelum', url: 'https://dia.pre-lanegrita.es', jobs: [Job.FrontEnd, Job.WebGL, Job.Modeler],
      description: '3D immersive web experience to showcase how laboratory diamonds are made. I worked on the 3D part of the project, creating a realistic and interactive 3D environment using _Three.js_ and _WebGL_ with _React_ + _Typescript_.',
      slides: [
        { video: 'video/dianelum.mp4', cover: true },
        { title: "The Experience", text: "An interactive 3D story about where diamonds come from. Visitors travel through two versions of the same world: the dark world of diamond mining, and the clean world of diamonds grown in a lab. A single diamond in front of the camera lets them look from one world into the other." },
        { video: 'video/dianelum.mp4' },
        { title: "The Idea", text: "Dianelum sells diamonds grown in a lab. Chemically they're identical to mined diamonds. The difference is everything that happens before the stone reaches you. The brand line says it in five words: Es lo mismo, pero no es igual, “it's the same, but it isn't equal”." },
        { text: "So we didn't make a product page. We built one world and told its story twice. On one side is the mining world: a dark mine entrance, miners and minecarts, an open-pit mine, smoking chimneys, cargo planes and bullets for conflict diamonds. On the other is the same landscape remade clean: a laboratory, scientists and robots, test tubes, wind turbines, forests and electric cars." },
        { text: "The visitor never has to read a comparison table. They see the difference with their own eyes." },
        { video: "video/dianelum2.webm" },
        { title: 'Scrolling through', text: 'The whole site is drawn in a single mint green. Each 3D object, from wind turbines and a telescope to a growing plant and a bank vault, is rendered in that same green, so they read as one sculpted world rather than stock imagery. The team section flips to near-black for contrast.' },
        { text: "The diamond itself is the layout grid. Scenes sit inside rotated-square frames, section numbers sit in diamond badges, and a star mark punctuates the headings." },
        { video: 'video/dianelum_marca1.webm' },
        { title: "Build", text: "The experience is a React app built on React Three Fiber and three.js. Every scene object is a glTF model loaded on demand, and the diamond has its own refractive material lit by HDR environment maps." },
        { text: "The site is a React app with React Router handling the six routes. GSAP ScrollTrigger drives the whole scroll story: it ties video playheads to scroll position, triggers the word reveals and runs the scrolling text bands. SplitText breaks the copy into words." },
      ],
    },
    {
      name: 'GOfit Design System', jobs: [Job.FrontEnd, Job.DesignSystem],
      description: "The component library behind GO fit's in-gym sales totem. Trainers use it to guide members to the right plan on screens of any size. It was built to become the foundation for every internal trainer app across the country.",
      slides: [
        { video: 'video/triptico_cover.webm', cover: true },
        { video: "video/triptico_cover.webm" },
        { title: "The challenge: Build a foundation", text: "The totem was the first app, but not the last. Every future internal tool for GO fit trainers would be built on the same system, by teams I might never work with." },
        { text: "Two constraints shaped everything. First, nobody knew which screens the app would run on: anything from a phone in a trainer's hand to a large display on a gym wall. Second, the components had to be generic enough to build apps that didn't exist yet." },
        { image: "img/projects/triptico1.png" },
        { title: "The whole interface scales as one", text: "The app had to look as designed on screens of unknown size, from a phone to a wall display. Every size in the system is in rem, and the root font size is tied to the viewport width. Above 1440px the root is 0.833vw, which is exactly 16px on the 1920px design. Type, spacing, radii and buttons then grow and shrink together, so a large display shows the same composition, just bigger." },
        { video: "video/triptico_rescale.webm" },
        { title: 'Design System', text: 'The system is in three layers, each built from the one below it:' },
        { text: "_Layout primitives_: gf-module is the section container (with page-header and call-to-action variants), alongside gf-grid (columns per breakpoint), gf-flex and gf-spacer. All of them read the spacing tokens, so a new page is composed rather than laid out by hand." },
        { text: "_Components_: a few configurable parts instead of many one-off ones. For example, a single gf-button covers every button through its variant, eight colour tones, three sizes and icon, round and disabled options." },
        { text: "_Patterns_: composed flows like the offer configurator, which a future app can reuse whole." },
        { text: "Mobile behaviour lives inside the primitives, so a new screen built from them is responsive without extra work. The design-system page itself renders the real production components with demo data, so the documentation can never drift from the code." },
        { video: "video/triptico_design_system.webm" },
        { title: "Impact and learnings", text: "_+16% subscriptions to higher-tier plans._ Comparing plans side by side made upgrades easier to see and easier to choose, and more members chose them." },
      ],
    },
    {
      name: 'Lolo López', url: 'https://bitcente.com/lololopez/', jobs: [Job.FrontEnd],
      description: 'A portfolio for Lolo López, a graphic designer focused on typography and editorial layout. He designed it to feel like a wall: dark plaster, neon-green marker strokes and tall condensed type. My job was to make that wall move without losing the hand-made feel.',
      slides: [
        { video: 'video/lololopez.mp4', cover: true },
        { video: 'video/lololopez.mp4' },
        { title: 'Concept', text: "Lolo's work sits between editorial design and street culture: album covers, zines and a graffiti publication. The challenge for the build was to keep that spontaneous, hand-made quality on screen. Static SVGs would look like stickers. The marks needed to look as if they were being painted while you watched, and the whole site had to stay as simple to browse as a printed portfolio: two screens, eight projects, one contact panel." },
        { video: 'video/lololopez1c.webm' },
        { title: "Build", text: "_CMS_. The site is a custom WordPress theme. Each project is built from flexible content blocks (image, video or text slide, each with its own format), so Lolo can add and reorder work himself without touching code. Projects are fetched on demand when opened." },
        { text: "_Motion_. GSAP runs everything that moves: ScrollSmoother for the smooth snapping between screens, SplitText for the line-by-line title reveals, ScrollTo for the jumps between home and projects, and TextPlugin for typed-out messages. The hand-drawn marks are animated with CSS stroke transitions, timed from shared variables so they all share one rhythm." },
        { text: "_Carousels_. Swiper powers the horizontal project galleries, with mouse-wheel and drag support on desktop." },
        { image: "img/projects/lololopez1.png" },
      ],
    },
/*     {
      name: 'Switzerland Trains', url: 'https://grandesmiradores.myswitzerland.com', jobs: [Job.FullStack],
      description: 'A campaign landing page for Switzerland Tourism, aimed at Spanish travellers. It follows Majo and her mother Pili on an eight-day trip across Switzerland by train, cable car and boat, from Zurich airport to Zermatt, the Aletsch glacier, Mürren, Lucerne and Mount Rigi, all on one ticket. The page lets the landscape do the talking: video first, text second.',
      slides: [
        { video: "video/suiza.webm", cover: true },
        { title: "The Project", text: "Switzerland Tourism wanted Spanish travellers to see that you can cross the Alps without a car: one Swiss Travel Pass, eight days, and some of the most spectacular cable cars and viewpoints in Europe." },
        { text: "The content was already strong: a series of travel films following Majo, one of the campaign's “modern Heidis”, and her mother Pili, one episode per day. The page's job was to make those films the experience. It had to feel like looking out of a train window, let people follow the route day by day, and still answer the practical questions: how long each leg takes, where to sleep, what the pass includes." },
        { image: "img/projects/suiza_carousel.png" },
        { title: "Build", text: "The site runs on WordPress with a custom theme. Every section is a self-contained module: hero video, article with map, episodes carousel, cards, image carousel and gallery. Each one is edited from the admin, and the page is assembled by stacking them, so content changes never need code." },
        { text: "Styling is Tailwind CSS. Locomotive Scroll handles the smooth scroll. GSAP's ScrollTrigger is synced to it for the reveals, and ScrollToPlugin drives the menu's glide to each section. Flickity powers the three carousels with drag and touch support, and the episode player is a vlite lightbox styled to match the page." },
        { text: "The heaviest assets are video and photography, so images load lazily as they come into view. The first thing the visitor loads is the hero film, and everything else arrives as the route scrolls in." },
        { video: "video/suiza.webm" },
        { title: "Impact", text: "The project turned the client into a recurring account, with new work every few months that grew the company's revenue." },
      ],
    }, */
    {
      name: 'Macenas Resort', url: 'https://www.macenasresort.com', jobs: [Job.FullStack],
      description: 'A modern website for the Macenas Resort, highlighting its amenities and services. _Full-stack_ project with extreme _SEO_ optimization work behind it.',
      slides: [
        { video: "video/macenas1.webm", cover: true },
        { video: "video/macenas1.webm" },
        { title: 'Overview', text: 'A modern website for the Macenas Resort, highlighting its amenities and services.' },
        { video: "video/macenas2.webm" },
        { title: 'My role', text: '_Full-stack_ project with extreme _SEO_ optimization work behind it.' },
      ],
    },
    {
      name: 'Popin_', url: 'https://popingroup.com', jobs: [Job.FullStack, Job.WebGL], awarded: true,
      description: "The website for Popin, an independent creative agency in Madrid that “makes brands feel good”. The brief was simple: their site should be as fun to use as their events are to attend. It became an Awwwards Site of the Day.",
      slides: [
        { video: 'video/popin.mp4', cover: true },
        { title: 'Make people feel good', text: "Popin's whole pitch is that they make brands feel good. A conventional agency site, with a reel, a grid of logos and a contact form, would have contradicted it." },
        { text: "So the goal wasn't to describe the agency but to behave like it. Every interaction should reward curiosity: things to drag, things that react, words that change. It still had to work as a sales tool, though, getting visitors to the projects and to a contact email quickly." },
        { text: "The site opens with a loader that counts to 100%, turns red, says “Ready” and waits for a click. From the first second, visitors are playing rather than reading." },
        { video: "video/popin_physics1.webm" },
        { title: "The problem", text: "Every agency lists its services, and nobody reads the list. Popin's six areas, from Health and Innovative Tech to Content & Social, needed to be remembered, not skimmed." },
        { text: " Hidden funny interactions are hidden across the web that engage people into keeping them watching and reading. We wanted it to feel more like an experience and less like a scrolling simulator. Are you bored? Why don't you try the piano menu and play Happy Birthday?" },
        { video: 'video/popin_fun1.webm' },
        { title: "Build", text: "The site is a custom WordPress theme, so Popin's team can add projects, categories and both languages (Spanish and English) without touching code." },
        { text: "_Page transitions_. Barba.js swaps pages in place, so nothing ever reloads." },
        { text: "_Scrolling_. Locomotive Scroll gives every page the same smooth, inertia-based scroll." },
        { text: "_Animation_. GSAP, with ScrollTrigger, SplitText, TextPlugin, CustomEase and CustomBounce, drives the scroll-based reveals, the retyping headline and the site's springy motion." },
        { text: "_Physics_. Matter.js powers the service shapes you can throw around." },
        { text: "_Carousels_. Swiper handles the sliding galleries." },
        { text: "_CMS_. WordPress with WPML lets the team edit content and run the Spanish and English versions." },
        { image: 'img/projects/popin2.png' },
        { title: "Result", "text": "Awwwards Site of the Day July 6th 2024. The site still carries the badge, and it's the clearest outside proof that the brief, an agency site that feels good to use, landed." },
        { image: 'img/projects/popin3.png' },
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